/**
 * workflows.js — Temporal Workflow Entry Point
 *
 * This file is kept intentionally thin:
 *  - Registers all Activity proxies with their timeouts
 *  - Defines Temporal Signals
 *  - Bootstraps runWorkflow: validates, sets up signals, calls runGraph()
 *
 * Business logic lives in workflow-engine/:
 *  - runner.js       → graph traversal, node dispatch, step counting
 *  - resolver.js     → {{variable}} interpolation
 *  - nodes/ai.js     → aiAgent Orchestrator loop
 *  - nodes/simple.js → all single-Activity nodes
 *  - nodes/logic.js  → if / for / while / trigger
 *  - nodes/subworkflow.js → child workflow execution
 */
import {
  proxyActivities,
  proxyLocalActivities,
  defineSignal,
  condition,
  setHandler,
  workflowInfo,
  executeChild,
  startChild,
  ApplicationFailure,
} from '@temporalio/workflow';
import { log } from '@temporalio/workflow';
import { runGraph } from './workflow-engine/runner.js';

// ─── Activity Proxies ─────────────────────────────────────────────────────────

/** Standard Activities (1 min timeout, no retry) */
const acts = proxyActivities({
  startToCloseTimeout: '1 minute',
  retry: { maximumAttempts: 1, initialInterval: '5s' },
});

/** Long-running AI Activities (10 min timeout, no retry) */
const aiActs = proxyActivities({
  startToCloseTimeout: '10 minutes',
  heartbeatTimeout: '1000s',
  retry: {
    initialInterval: '500s',
    backoffCoefficient: 2,
    maximumInterval: '221 minute',
    maximumAttempts: 1,
  },
});

/** Skill tool execution Activities (5 min timeout) */
const skillActs = proxyActivities({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 1 },
});

/** Local Activities (fast, in-process, <10s) */
const localActs = proxyLocalActivities({
  startToCloseTimeout: '10s',
});

/**
 * Convenience bundle: all proxied activities merged into one object
 * and passed to the runner so node handlers don't import proxies themselves.
 * (Temporal proxies must be created in the workflow function scope.)
 */
/**
 * Convenience bundle: all proxied activities merged into one object.
 * We must NOT use spread (...acts) because Temporal proxies are not enumerable.
 */
function buildActivityBundle() {
  return {
    // Standard Acts (mapped to acts proxy)
    initializeWorkflow: localActs.initializeWorkflow,
    ensureConversation: localActs.ensureConversation,
    getAssistantMessageId: localActs.getAssistantMessageId,
    addMessage: localActs.addMessage,
    prepareConversation: localActs.prepareConversation,
    persistResponse: localActs.persistResponse, // Moved to localActs for performance
    updateExecutionStatus: localActs.updateExecutionStatus,
    appendNodeResult: localActs.appendNodeResult,
    emitActivityEvent: localActs.emitActivityEvent,
    getExecutionLogs: localActs.getExecutionLogs,
    handleCreateDocument: localActs.handleCreateDocument,

    fetchMemory: localActs.fetchMemory,
    loadMemory: localActs.loadMemory,
    upsertMemorySection: localActs.upsertMemorySection,
    fetchMemorySection: localActs.fetchMemorySection,
    fetchRecentSnapshots: localActs.fetchRecentSnapshots,
    getMemoryHeaders: localActs.getMemoryHeaders,
    handleFetchResources: localActs.handleFetchResources,
    readAppDocument: localActs.readAppDocument,
    getAppDocumentBlocks: localActs.getAppDocumentBlocks,

    vectorSearch: acts.vectorSearch,
    vectorIndex: acts.vectorIndex,
    handleDingTalkRobot: acts.handleDingTalkRobot,
    handleSkillAction: acts.handleSkillAction,

    // AI & Long-running (mapped to aiActs proxy)
    handlePluginAction: aiActs.handlePluginAction,
    handleBlockNoteAction: aiActs.handleBlockNoteAction,
    handleAITurn: aiActs.handleAITurn,

    // Skill tool (mapped to skillActs proxy)
    executeSkillTool: skillActs.executeSkillTool,
    prepareDigitalEmployeeConfig: skillActs.prepareDigitalEmployeeConfig,
  };
}

// ─── Signals ─────────────────────────────────────────────────────────────────
export const dataUpdateSignal = defineSignal('dataUpdate');
export const activityCompleteSignal = defineSignal('activityComplete');

// ─── Main Workflow ────────────────────────────────────────────────────────────
/**
 * Temporal Workflow for executing a graph of nodes.
 * Supports sequential flow, if/for/while loops, AI agents, sub-workflows etc.
 */
export async function runWorkflow(workflowRef, triggerData = {}, executionId = null) {
  log.info('runWorkflow triggered', {
    workflowRefType: typeof workflowRef,
    workflowRefStr: JSON.stringify(workflowRef),
    hasTriggerData: !!triggerData,
    executionId,
  });

  // ── 1. Bootstrap: Resolve, Validate and Create Record ──────────────────
  const initResult = await localActs.initializeWorkflow({
    workflowRef,
    triggerData,
    executionId,
  });

  if (!initResult.success) {
    throw ApplicationFailure.nonRetryable(
      `Workflow bootstrap failed: ${initResult.reason}`,
      'BOOTSTRAP_ERROR',
    );
  }

  const { workflowData, isAnonymous } = initResult;
  executionId = initResult.executionId;

  log.info('Temporal Workflow runWorkflow started', {
    workflowId: workflowData._id,
    executionId,
    appId: triggerData?.appId || workflowData?.appId,
  });

  // ── 2. Signal state ─────────────────────────────────────────────────────
  const latestFormDataRef = { value: null };
  setHandler(dataUpdateSignal, (data) => {
    latestFormDataRef.value = data;
  });

  const pendingSignalResults = new Map();
  setHandler(activityCompleteSignal, ({ nodeId, result, error }) => {
    if (nodeId) pendingSignalResults.set(nodeId, { result, error, receivedAt: new Date() });
  });

  // ── 3. Normalize Context ────────────────────────────────────────────────
  if (triggerData) {
    const rawAppId = triggerData.appId || workflowData.appId;
    triggerData.appId = rawAppId === 'null' || rawAppId === 'undefined' ? null : rawAppId;
    if (!triggerData.orgId && workflowData.organizationId)
      triggerData.orgId = workflowData.organizationId;
    if (!triggerData.triggeredBy && workflowData.createdBy)
      triggerData.triggeredBy = workflowData.createdBy;
  }

  // ── 4. Run the graph ─────────────────────────────────────────────────────
  try {
    const finalResults = await runGraph({
      nodes: workflowData.nodes,
      edges: workflowData.edges,
      triggerData,
      workflowData,
      executionId,
      acts: buildActivityBundle(),
      localActs,
      executeChildFn: executeChild,
      startChildFn: startChild,
      conditionFn: condition,
      latestFormDataRef,
      pendingSignalResults,
    });

    if (executionId && !isAnonymous) {
      await acts.updateExecutionStatus(executionId, {
        status: 'SUCCESS',
        endTime: new Date(),
      });
    }
    return finalResults;
  } catch (err) {
    let errorMsg = err.message;
    let cur = err;
    while (cur.cause?.message) {
      cur = cur.cause;
      errorMsg = cur.message;
    }

    // Emit real-time event for SSE
    await localActs.emitActivityEvent('workflow:error', {
      workflowId: workflowData._id,
      executionId,
      error: errorMsg,
    });

    if (executionId && !isAnonymous) {
      await acts.updateExecutionStatus(executionId, {
        status: 'FAILED',
        endTime: new Date(),
        error: { message: errorMsg, stack: err.stack },
      });
    }
    throw err;
  }
}
