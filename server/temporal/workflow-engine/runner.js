/**
 * workflow-engine/runner.js
 *
 * The core execution engine for a workflow graph.
 * Responsibilities:
 *  - Dependency resolution: execute addon/slot nodes before the main node
 *  - Step counting / circuit breaker
 *  - Per-node event emission (node:start, node:success, node:error)
 *  - Dispatching to the correct handler via NODE_HANDLERS
 *  - Signal waiting (shouldWaitForSignal)
 *  - Sequential traversal of the graph
 */
import { condition, log } from '@temporalio/workflow';
import { resolveVariables } from './resolver.js';
import { TRIGGER_TYPES, mergeTriggerDefaults } from '../../utils/workflowUtils.js';
import { handleAINode } from './nodes/ai.handler.js';
import {
  handleIf,
  handleWhile,
  handleFor,
  handleWaitUpdate,
  handleTrigger,
  handleEnd,
} from './nodes/logic.handler.js';
import { handleSimpleNode } from './nodes/simple.handler.js';

// ─── Node type → handler mapping ───────────────────────────────────────────
// Handlers that need a rich ctx object
const COMPLEX_HANDLERS = {
  aiAgent: handleAINode,
  if: handleIf,
  while: handleWhile,
  for: handleFor,
  waitUpdate: handleWaitUpdate,
  trigger: handleTrigger,
  webhook: handleTrigger,
  click: handleTrigger,
  capability: handleTrigger,
  dataChange: handleTrigger,
  schedule: handleTrigger,
  'plugin-trigger': handleTrigger,
  end: handleEnd,
};

/**
 * Run a single workflow graph to completion.
 */
export async function runGraph({
  nodes,
  edges,
  triggerData,
  workflowData,
  executionId,
  // Activity proxies
  acts, // standard activities
  localActs, // local activities
  // Temporal primitives (passed in from workflows.js to preserve determinism context)
  executeChildFn,
  startChildFn,
  conditionFn,
  // Signal state (managed by caller)
  latestFormDataRef,
  pendingSignalResults,
}) {
  const nodeResults = new Map();
  const loopStates = new Map();
  const maxSteps = 500;
  let steps = 0;

  // ── Clean dangling edges (where source or target node is missing in nodes array) ──
  const activeNodeIds = new Set(nodes.map((n) => n.id));
  const cleanedEdges = edges.filter(
    (e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target),
  );

  // Find trigger node to start traversal
  const triggerNode = nodes.find((n) => TRIGGER_TYPES.includes(n.type));
  if (!triggerNode) throw new Error('No trigger node found');

  // Merge configured default values/mappings from triggerNode.data.inputs/params
  mergeTriggerDefaults(nodes, triggerData);

  nodeResults.set(triggerNode.id, triggerData);
  let currentNode = triggerNode;
  let previousNodeId = null;

  pendingSignalResults.clear();

  const realWorkflowId = workflowData._id.toString();

  // ── executeNode: resolves deps, executes, stores result ─────────────────
  const executeNode = async (nodeId, forceReExecute = false) => {
    if (!forceReExecute && nodeResults.has(nodeId)) return nodeResults.get(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return null;

    // Resolve addon/slot dependencies first
    const addonEdges = cleanedEdges.filter(
      (e) => e.target === nodeId && e.targetHandle && e.targetHandle.endsWith('-slot'),
    );
    for (const edge of addonEdges) {
      if (!nodeResults.has(edge.source)) {
        log.info(`[Runner] Resolving dependency: ${edge.source} for ${nodeId}`);
        await executeNode(edge.source, false);
      }
    }

    steps++;
    if (steps >= maxSteps)
      throw new Error('Workflow step limit exceeded (Infinite loop prevention)');

    const { status, lastResult, lastError, outputs, properties, ...cleanData } = node.data || {};

    // 关键修复：逻辑节点的 condition 字段禁止在 generic resolveVariables 中被直接解析
    const isLogicExpr = ['if', 'while'].includes(node.type);
    const dataToResolve = { ...cleanData };

    // end 节点的 outputs 是运行时模板（如 {{aiAgent.result}}），必须放入 resolveVariables 解析
    // 其他节点（plugin-action 等）的 outputs 是输出描述符，不需要解析
    if (node.type === 'end' && outputs !== undefined) {
      dataToResolve.outputs = outputs;
    }
    let rawCondition = null;
    if (isLogicExpr && dataToResolve.condition) {
      rawCondition = dataToResolve.condition;
      delete dataToResolve.condition;
    }

    // Pass 1: Resolve standard variables first (this resolves inner variables like {{trigger.targetId}})
    const semiResolvedData = resolveVariables(
      dataToResolve,
      nodeResults,
      triggerData,
      previousNodeId === node.id ? null : previousNodeId,
      node.id,
    );

    // Pass 2: Resolve instructions (like readDoc now that it has the resolved docId)
    const appId = triggerData?.appId || workflowData?.appId;
    const instructionResults = {};
    const instructions = findInstructionPlaceholders(semiResolvedData);
    if (instructions.length > 0) {
      const runContext = {
        trigger: triggerData,
        previousNode: previousNodeId ? nodeResults.get(previousNodeId) : undefined,
      };
      for (const [k, v] of nodeResults.entries()) {
        runContext[k] = v;
      }

      await Promise.all(
        instructions.map(async ({ command, argument }) => {
          const argKey = argument ? argument.trim() : '';
          const key = `${command}|${argKey}`;
          const res = await runInstruction(command, argument, appId, acts, runContext);
          if (res !== null) {
            instructionResults[key] = res;
          }
        }),
      );
    }
    let resolvedData = replaceInstructionPlaceholders(semiResolvedData, instructionResults);

    // Pass 3: Re-resolve standard variables in case the instruction output brought in new variables
    resolvedData = resolveVariables(
      resolvedData,
      nodeResults,
      triggerData,
      previousNodeId === node.id ? null : previousNodeId,
      node.id,
    );

    // 还原原始 condition 模板给 logic.handler 处理
    if (rawCondition) {
      resolvedData.condition = rawCondition;
    }

    let shouldWaitForSignal = resolvedData.waitForSignal || false;
    if (COMPLEX_HANDLERS[node.type]) {
      shouldWaitForSignal = false; // Orchestrator pattern: no signal waiting on AI nodes
    }

    let result = null;
    let nextHandleId = null;
    let isFinal = false;

    try {
      await localActs.emitActivityEvent('node:start', {
        workflowId: realWorkflowId,
        executionId,
        nodeId: node.id,
        sessionId: triggerData?.sessionId,
        parentExecutionId: triggerData?.parentExecutionId,
      });

      // ── Mock short-circuit ──────────────────────────────────────────────
      if (resolvedData.isMock) {
        log.info('Mocking node execution', { nodeId: node.id });
        let mockResult = resolvedData.mockData;
        try {
          if (
            typeof mockResult === 'string' &&
            (mockResult.startsWith('{') || mockResult.startsWith('['))
          ) {
            mockResult = JSON.parse(mockResult);
          }
        } catch (e) {
          log.warn('Failed to parse mock data as JSON', { nodeId: node.id });
        }
        result =
          mockResult &&
          typeof mockResult === 'object' &&
          mockResult.result !== undefined &&
          mockResult.resolvedConfig !== undefined
            ? mockResult.result
            : mockResult;

        if (node.type === 'if') nextHandleId = result.evaluation ? 'true' : 'false';
        else if (node.type === 'while') nextHandleId = result.evaluation ? 'loop' : 'exit';
        else if (node.type === 'for') nextHandleId = result.finished ? 'exit' : 'loop';
        else if (TRIGGER_TYPES.includes(node.type)) {
          if (result && typeof result === 'object') Object.assign(triggerData, result);
        }
      } else {
        // ── Real execution ────────────────────────────────────────────────
        const ctx = {
          node,
          nodes,
          edges: cleanedEdges,
          nodeResults,
          loopStates,
          triggerData,
          workflowData,
          workflowId: realWorkflowId,
          executionId,
          acts,
          localActs,
          executeChild: executeChildFn,
          startChild: startChildFn,
          condition: conditionFn,
          latestFormDataRef,
          log,
        };

        const handler = COMPLEX_HANDLERS[node.type];
        if (handler) {
          const handlerResult = await handler(resolvedData, ctx);
          result = handlerResult.result;
          nextHandleId = handlerResult.nextHandleId || null;
          isFinal = handlerResult.isFinal || false;
        } else {
          const simpleResult = await handleSimpleNode(node, resolvedData, ctx);
          result = simpleResult.result;
          nextHandleId = simpleResult.nextHandleId || null;
          isFinal = simpleResult.isFinal || false;
        }
      }

      // ── Signal wait (async mode) ────────────────────────────────────────
      if (shouldWaitForSignal) {
        const timeoutSeconds = resolvedData.timeout || 86400;
        const signalReceived = await conditionFn(
          () => pendingSignalResults.has(node.id),
          timeoutSeconds * 1000,
        );
        if (signalReceived) {
          const signalData = pendingSignalResults.get(node.id);
          if (signalData.error) throw new Error(signalData.error);
          result = { ...result, ...signalData.result, status: 'COMPLETED' };
          pendingSignalResults.delete(node.id);
        } else {
          throw new Error(`Async wait timed out after ${timeoutSeconds} seconds`);
        }
      }

      const nodeRecord = {
        result,
        resolvedConfig: resolvedData,
        nextHandleId,
        isFinal,
        timestamp: Date.now(),
      };

      const isAnonymous = executionId && executionId.startsWith('trial-');
      if (executionId && !isAnonymous && typeof localActs.appendNodeResult === 'function') {
        await localActs.appendNodeResult(executionId, node.id, nodeRecord);
      }

      await localActs.emitActivityEvent('node:success', {
        workflowId: realWorkflowId,
        executionId,
        nodeId: node.id,
        sessionId: triggerData?.sessionId,
        parentExecutionId: triggerData?.parentExecutionId,
        result,
        resolvedConfig: resolvedData,
      });

      nodeResults.set(node.id, nodeRecord);
      return nodeRecord;
    } catch (err) {
      let errorMsg = err.message;
      let cur = err;
      while (cur.cause?.message) {
        cur = cur.cause;
        errorMsg = cur.message;
      }
      await localActs.emitActivityEvent('node:error', {
        workflowId: realWorkflowId,
        executionId,
        nodeId: node.id,
        sessionId: triggerData?.sessionId,
        parentExecutionId: triggerData?.parentExecutionId,
        error: errorMsg,
        stack: err.stack,
      });
      throw err;
    }
  };

  // ── Sequential graph traversal ───────────────────────────────────────────
  while (currentNode && steps < maxSteps) {
    const nodeSummary = await executeNode(currentNode.id, true);
    if (!nodeSummary) break;

    // ── 核心同步逻辑：将入口节点的处理结果（含默认值）回填至全局 {{trigger}} 空间 ───────
    const isTrigger = TRIGGER_TYPES.includes(currentNode.type);

    if (isTrigger && nodeSummary.result && typeof nodeSummary.result === 'object') {
      log.info(`[Runner] Syncing trigger node outputs to global trigger context`, {
        keys: Object.keys(nodeSummary.result),
      });
      // 这里的 Object.assign 会递归影响整个工作流生命周期的变量解析
      Object.assign(triggerData, nodeSummary.result);
    }

    // ── Early exit for terminal 'end' nodes ────────────────────────────────
    if (nodeSummary.isFinal) {
      log.info(`[Runner] Hit terminal 'end' node. Returning explicit result.`);
      return nodeSummary.result;
    }

    const { nextHandleId } = nodeSummary;
    previousNodeId = currentNode.id;

    const edge = cleanedEdges.find(
      (e) =>
        e.source === currentNode.id &&
        (nextHandleId ? e.sourceHandle === nextHandleId : !e.sourceHandle),
    );
    if (!edge) break;
    currentNode = nodes.find((n) => n.id === edge.target);
  }

  if (steps >= maxSteps) throw new Error('Workflow step limit exceeded (Infinite loop prevention)');

  return Object.fromEntries(nodeResults);
}

const INSTRUCTION_REGEX = /\$\[([a-zA-Z0-9_]+)(?:\|([^\]]+))?\]/g;

function findInstructionPlaceholders(obj, instructions = []) {
  if (typeof obj === 'string') {
    let match;
    INSTRUCTION_REGEX.lastIndex = 0;
    while ((match = INSTRUCTION_REGEX.exec(obj)) !== null) {
      instructions.push({
        raw: match[0],
        command: match[1].trim(),
        argument: match[2] ? match[2].trim() : undefined,
      });
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      findInstructionPlaceholders(item, instructions);
    }
  } else if (obj !== null && typeof obj === 'object') {
    for (const key in obj) {
      findInstructionPlaceholders(obj[key], instructions);
    }
  }
  return instructions;
}

const get = (obj, path) => {
  if (!obj) return undefined;
  return path.split('.').reduce((o, key) => (o && o[key] !== undefined ? o[key] : undefined), obj);
};

async function runInstruction(command, argument, appId, acts, context) {
  const now = new Date();
  if (command === 'date') {
    const arg = argument ? argument.trim() : 'today';
    const dateObj = {
      today: now.toISOString().split('T')[0],
      now: now.toISOString(),
      year: now.getFullYear().toString(),
      month: (now.getMonth() + 1).toString().padStart(2, '0'),
      day: now.getDate().toString().padStart(2, '0'),
      timestamp: now.getTime().toString(),
    };
    if (dateObj[arg] !== undefined) {
      return dateObj[arg];
    }
    // Format date format string
    return arg
      .replace(/YYYY/g, now.getFullYear())
      .replace(/MM/g, String(now.getMonth() + 1).padStart(2, '0'))
      .replace(/DD/g, String(now.getDate()).padStart(2, '0'))
      .replace(/HH/g, String(now.getHours()).padStart(2, '0'))
      .replace(/mm/g, String(now.getMinutes()).padStart(2, '0'))
      .replace(/ss/g, String(now.getSeconds()).padStart(2, '0'));
  }

  if (command === 'readDoc' && argument) {
    let docId = argument.trim();
    const isPath = docId.includes('.') || docId === 'trigger' || docId === 'previousNode';
    if (isPath) {
      if (context) {
        const resolved = get(context, docId);
        if (resolved !== undefined && resolved !== null) {
          docId = String(resolved);
        } else {
          return `[Error: Variable "${docId}" is empty or not found]`;
        }
      } else {
        return `[Error: Variable "${docId}" not resolved]`;
      }
    }
    try {
      return await acts.readAppDocument({ docId });
    } catch (e) {
      return `[Error: Document "${docId}" not found]`;
    }
  }

  if (command === 'readBlockPrompt' && argument) {
    let docId = argument.trim();
    const isPath = docId.includes('.') || docId === 'trigger' || docId === 'previousNode';
    if (isPath) {
      if (context) {
        const resolved = get(context, docId);
        if (resolved !== undefined && resolved !== null) {
          docId = String(resolved);
        } else {
          return `[Error: Variable "${docId}" is empty or not found]`;
        }
      } else {
        return `[Error: Variable "${docId}" not resolved]`;
      }
    }
    try {
      const result = await acts.getAppDocumentBlocks({ docId, compilePrompt: true });
      return result.prompt;
    } catch (e) {
      // Fallback: if getAppDocumentBlocks is not a registered activity, execute readAppDocument directly
      try {
        const docText = await acts.readAppDocument({ docId });
        return `Document State: ${docText}\n\nIncremental block edit tools are available.`;
      } catch (err) {
        return `[Error: Document "${docId}" not found]`;
      }
    }
  }

  return null;
}

function replaceInstructionPlaceholders(obj, results) {
  if (typeof obj === 'string') {
    return obj.replace(INSTRUCTION_REGEX, (match, command, argument) => {
      const argKey = argument ? argument.trim() : '';
      const key = `${command.trim()}|${argKey}`;
      return results[key] !== undefined ? results[key] : match;
    });
  } else if (Array.isArray(obj)) {
    return obj.map((item) => replaceInstructionPlaceholders(item, results));
  } else if (obj !== null && typeof obj === 'object') {
    const res = {};
    for (const key in obj) {
      res[key] = replaceInstructionPlaceholders(obj[key], results);
    }
    return res;
  }
  return obj;
}
