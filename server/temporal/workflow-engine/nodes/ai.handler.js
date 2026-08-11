/**
 * workflow-engine/nodes/ai.handler.js
 *
 * Handles the aiAgent / ai-action / AI_AGENT node type.
 *
 * Implements the Orchestrator Pattern:
 *   - Collects skills, memory addons and knowledge nodes from edges
 *   - Drives the ReAct while-loop at the Workflow level (not inside an Activity)
 *   - recall_memory → native executeChild (no Activity slot waste)
 *   - skill tools   → executeSkillTool Activity
 *   - final text    → break loop and return result
 *
 * ctx: { node, nodes, edges, nodeResults, triggerData, workflowData,
 *         workflowId, executionId, acts, executeChild, log }
 */

import { getToolDisplayMode } from '../../../agent/tools/displayMode.js';

const MAX_AI_ROUNDS = 20;

export async function handleAINode(resolvedData, ctx) {
  const { log, node } = ctx;

  // 1. Prepare base data
  const commonAiData = _prepareCommonData(resolvedData, ctx);

  // 2. Collect connected resources (Skills, Memory, Knowledge)
  const resources = await _collectResources(resolvedData, ctx, commonAiData);

  // 3. Identify Assistant Message ID for persistence
  const assistantMessageId = await _findAssistantMessageId(
    resolvedData,
    ctx,
    resources.isConversational,
    resources.finalConversationId,
  );

  // 4. Run the Orchestrator ReAct Loop
  const result = await _executeOrchestratorLoop(commonAiData, resources, assistantMessageId, ctx);

  return result;
}

/** ── Helper: Build base data for all AI turns ─────────────────────────── */
function _prepareCommonData(resolvedData, ctx) {
  const { nodeResults, triggerData, workflowData, executionId } = ctx;
  return {
    outputMode: 'full',
    ...resolvedData,
    context: Object.fromEntries(nodeResults),
    userId: triggerData?.triggeredBy,
    orgId: triggerData?.orgId || workflowData?.organizationId,
    appId: triggerData?.appId || workflowData?.appId,
    executionId,
    parentExecutionId: triggerData?.parentExecutionId,
    // sessionId: prefer explicit field, fallback to conversationId (used in chat flows)
    sessionId: triggerData?.sessionId || resolvedData?.sessionId,
    sessionName: triggerData?.sessionName || resolvedData?.sessionName,
    empEnhancedSkillIds: triggerData?.empEnhancedSkillIds,
    empEnhancedSystemPrompt: triggerData?.empEnhancedSystemPrompt,
    refs: triggerData?.refs || [],
  };
}

/** ── Helper: Collect connected skills, memory and knowledge ────────────── */
async function _collectResources(resolvedData, ctx, commonAiData) {
  const { node, edges, nodeResults, acts, log } = ctx;

  // a) Skills
  const connectedSkillIds = [];
  const toolNodeMap = {};
  edges
    .filter((e) => e.target === node.id && e.targetHandle === 'tool-slot')
    .forEach((te) => {
      const snResult = nodeResults.get(te.source)?.result;
      if (!snResult?.skillIds) return;
      const ids = Array.isArray(snResult.skillIds)
        ? snResult.skillIds
        : String(snResult.skillIds)
            .split(/[\|,]/)
            .map((s) => s.trim());
      ids.forEach((sid) => {
        if (!sid) return;
        connectedSkillIds.push(sid);
        if (!toolNodeMap[sid]) toolNodeMap[sid] = [];
        toolNodeMap[sid].push(te.source);
      });
    });
  commonAiData.skillIds = [
    ...(Array.isArray(commonAiData.skillIds) ? commonAiData.skillIds : []),
    ...connectedSkillIds,
  ];
  commonAiData.toolNodeMap = toolNodeMap;

  // b) Memory
  const memorySlotEdges = edges.filter(
    (e) => e.target === node.id && e.targetHandle === 'memory-slot',
  );
  let finalConversationId = resolvedData.conversationId || ctx.triggerData?.conversationId;
  const memoryMessages = [];

  for (const me of memorySlotEdges) {
    const config = nodeResults.get(me.source)?.result;
    if (!config) continue;
    if (config.conversationId) finalConversationId = config.conversationId;

    log.info('[AINode] Fetching conversation memory within handler.', { finalConversationId });
    const memoryResult = await acts.fetchMemory(finalConversationId, {
      limit: config.limit || node.data?.memoryLimit || 10,
      afterTime: config.afterTime,
    });
    if (memoryResult?.messages) memoryMessages.push(...memoryResult.messages);
  }

  const isConversational =
    (memorySlotEdges.length > 0 || !!resolvedData.conversationId) && !!finalConversationId;
  if (memoryMessages.length > 0) commonAiData.memoryMessages = memoryMessages;

  // c) Knowledge
  const memoryContextStrings = [];
  let memoryWorkflowId = null;

  edges
    .filter((e) => e.target === node.id && e.targetHandle === 'knowledge-slot')
    .forEach((ke) => {
      const r = nodeResults.get(ke.source)?.result;
      if (!r) return;
      if (r.plainText) memoryContextStrings.push(r.plainText);
      if (r.contextString) memoryContextStrings.push(r.contextString);

      const sourceWorkflowId = r.memoryWorkflowId || r.workflowId;
      if (sourceWorkflowId) memoryWorkflowId = sourceWorkflowId;
    });

  if (memoryContextStrings.length > 0) {
    commonAiData.memoryContext = memoryContextStrings.join('\n\n---\n\n');
  }
  if (memoryWorkflowId) commonAiData.memoryWorkflowId = memoryWorkflowId;

  return { isConversational, finalConversationId, memoryMessages };
}

/** ── Helper: Multi-stage Assistant Message ID identification ───────────── */
async function _findAssistantMessageId(resolvedData, ctx, isConversational, finalConversationId) {
  const { triggerData, nodeResults, acts, log } = ctx;
  let assistantMessageId = resolvedData.assistantMessageId || triggerData?.assistantMessageId;

  // [SMART REUSE 1] Scan previous nodes if not explicitly passed
  if (!assistantMessageId) {
    for (const [nodeId, nodeRes] of nodeResults) {
      const foundId = nodeRes?.result?.messageId;
      if (foundId) {
        assistantMessageId = foundId;
        log.info('[AINode] Reusing assistantMessageId from previous node results.', {
          sourceNodeId: nodeId,
          messageId: foundId,
        });
        break;
      }
    }
  }

  // [SMART REUSE 2] Server-side check
  // if (!assistantMessageId && isConversational) {
  //   log.info('[AINode] Looking for existing bubble on server.', { finalConversationId });
  //   const bubbleRes = await acts.getAssistantMessageId({
  //     conversationId: finalConversationId,
  //   });
  //   assistantMessageId = bubbleRes;
  // }

  if (isConversational && !assistantMessageId) {
    log.info(
      '[AINode] Conversational mode but no chat bubble ID identified. Skipping persistence.',
    );
  }

  return assistantMessageId;
}

/** ── Helper: Core ReAct Loop orchestrator ─────────────────────────────── */
async function _executeOrchestratorLoop(commonAiData, resources, assistantMessageId, ctx) {
  const { node, workflowId, executionId, acts, executeChild, log } = ctx;
  const { isConversational } = resources;
  const isSilent = commonAiData.outputMode === 'silent';
  const silentText = commonAiData.silentText;

  // [SILENT MODE] Provide immediate placeholder feedback as a STAGE
  if (isSilent && silentText) {
    if (assistantMessageId) {
      await acts.persistResponse({
        assistantMessageId,
        stage: silentText, // We'll update persistResponse to handle 'stage' field
      });
    }
    // Stream it to UI as a stage (does NOT require assistantMessageId)
    await acts.emitActivityEvent('node:progress', {
      workflowId,
      executionId,
      nodeId: node.id,
      status: 'stage',
      content: silentText,
      parentExecutionId: ctx.triggerData?.parentExecutionId,
    });
  }

  let aiRound = 0;
  let conversationMessages = [];
  let finalAiResult = null;
  const totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  while (aiRound < MAX_AI_ROUNDS) {
    aiRound++;
    log.info(`[AINode] Orchestrator round ${aiRound}`, { nodeId: node.id });

    const turnResult = await acts.handleAITurn(
      {
        ...commonAiData,
        messages: conversationMessages,
        assistantMessageId,
      },
      node.id,
      workflowId,
    );

    // Update cumulative usage
    const roundUsage = turnResult.usage || {};
    totalUsage.promptTokens += roundUsage.promptTokens || 0;
    totalUsage.completionTokens += roundUsage.completionTokens || 0;
    totalUsage.totalTokens += roundUsage.totalTokens || 0;

    // [PROGRESSIVE PERSISTENCE] Save thoughts and content immediately
    if (
      isConversational &&
      assistantMessageId &&
      (turnResult.thought || turnResult.content || turnResult.toolCalls?.length)
    ) {
      await acts.persistResponse({
        assistantMessageId,
        thought: turnResult.thought,
        content: turnResult.content,
        toolCalls: turnResult.toolCalls,
        usage: totalUsage,
        hidden: isSilent,
      });
    }

    if (turnResult.type === 'client_tool') {
      // 检查是否是内置的 sleep 客户端工具
      const sleepCall = turnResult.toolCalls.find((tc) => tc.name === 'sleep');
      if (sleepCall) {
        const seconds = sleepCall.args?.seconds || 5;
        log.info(`[AINode] Executing client_tool sleep natively in workflow: sleeping for ${seconds}s`);
        
        // 1. 通知前端开始进入休眠（工具输入开始）
        await acts.emitActivityEvent('node:progress', {
          workflowId,
          executionId,
          nodeId: node.id,
          status: 'tool-input-start',
          toolCallId: sleepCall.id,
          toolName: 'sleep',
          parentExecutionId: ctx.triggerData?.parentExecutionId,
        });

        // 2. 调用 Temporal 原生非阻塞 sleep（这需要 workflows.js 中导入的 sleep，或者在 ctx 里把 Temporal 包装过的 sleep/condition 传进来，或者直接导入）
        // 提示：因为 ai.handler.js 运行在 Temporal sandbox 中，可以直接导入或从 ctx 里面获取。
        // 等等，Temporal 的 workflow 核心库是 '@temporalio/workflow'。我们可以在这里 import { sleep } from '@temporalio/workflow'。
        const { sleep } = await import('@temporalio/workflow');
        await sleep(seconds * 1000);

        // 3. 通知前端休眠结束，并返回给大模型 Tool 结果
        const toolContent = `Successfully slept for ${seconds} seconds.`;
        const sleepDisplayMode = getToolDisplayMode('sleep');
        if (commonAiData.outputMode !== 'silent' && sleepDisplayMode !== 'name-only') {
          await acts.emitActivityEvent('node:progress', {
            workflowId,
            executionId,
            nodeId: node.id,
            status: 'tool-result',
            toolName: 'sleep',
            toolCallId: sleepCall.id,
            result: toolContent,
            parentExecutionId: ctx.triggerData?.parentExecutionId,
          });
        }

        // 把 Tool 结果喂回上下文消息中，以便大模型下一轮获取
        conversationMessages.push(turnResult.rawAIMessage);
        conversationMessages.push({
          role: 'tool',
          tool_call_id: sleepCall.id,
          content: toolContent,
        });

        // [BATCH PERSISTENCE] 保存休眠工具执行结果到数据库
        if (isConversational && assistantMessageId) {
          await acts.persistResponse({
            assistantMessageId,
            toolResult: [
              {
                result: toolContent,
                toolCallId: sleepCall.id,
              },
            ],
            hidden: isSilent,
          });
        }

        // 继续下一轮 ReAct 轮询
        continue;
      }

      // 如果有其他的 client_tool，暂时跳出
      finalAiResult = turnResult;
      break;
    }

    if (turnResult.type === 'final') {
      finalAiResult = turnResult;
      break;
    }

    if (turnResult.type === 'tool_call') {
      conversationMessages.push(turnResult.rawAIMessage);
      let suppressedSummaryHint = null;

      // PARALLEL EXECUTION: Run all tool calls in the same turn simultaneously to save time
      log.info(`[AINode] Parallel execution of ${turnResult.toolCalls.length} tools`);

      const toolPromises = turnResult.toolCalls.map(async (tc) => {
        const toolContent = await _dispatchToolCall(tc, turnResult, commonAiData, {
          executeChild,
          acts,
          workflowId,
          executionId,
          aiRound,
          node,
          log,
        });

        // Check for specific summary suppression logic
        const skillMeta = turnResult.skillMap?.[tc.name];
        if (
          turnResult.toolCalls.length === 1 &&
          skillMeta?.type === 'PACKAGE_SKILL' &&
          typeof toolContent === 'string' &&
          toolContent.length > 250
        ) {
          suppressedSummaryHint =
            '[SYSTEM HINT: The expert has already provided a comprehensive report above. Do NOT repeat or summarize findings.]';
        }

        return {
          role: 'tool',
          tool_call_id: tc.id,
          content: typeof toolContent === 'string' ? toolContent : JSON.stringify(toolContent),
          rawResult: toolContent, // Keep raw for batch persistence
        };
      });

      const toolResults = await Promise.all(toolPromises);

      // [BATCH PERSISTENCE] Save all tool results at once after they all finish
      if (isConversational && assistantMessageId) {
        await acts.persistResponse({
          assistantMessageId,
          toolResult: toolResults.map((tr) => ({
            result: tr.rawResult,
            toolCallId: tr.tool_call_id,
          })),
          hidden: isSilent,
        });
      }

      conversationMessages.push(...toolResults.map(({ rawResult, ...rest }) => rest));

      if (suppressedSummaryHint) {
        conversationMessages.push({ role: 'system', content: suppressedSummaryHint });
      }
    }
  }

  await acts.emitActivityEvent('node:progress', {
    workflowId,
    executionId,
    nodeId: node.id,
    status: 'finish-step',
    parentExecutionId: ctx.triggerData?.parentExecutionId,
  });

  if (!finalAiResult) {
    finalAiResult = { content: 'Max reasoning rounds reached.', usage: totalUsage };
  }

  return {
    result: {
      ...(finalAiResult.json && typeof finalAiResult.json === 'object' ? finalAiResult.json : {}),
      intent: finalAiResult.intent,
      json: finalAiResult.json,
      result: finalAiResult.content || 'No response from AI',
      usage: totalUsage,
      toolCalls: finalAiResult.toolCalls,
      assistantMessageId,
    },
  };
}

async function _dispatchToolCall(
  tc,
  turnResult,
  commonAiData,
  { executeChild, acts, workflowId, executionId, aiRound, node, log },
) {
  // 核心：在执行前通知前端工具正在运行
  // await acts.emitActivityEvent('node:progress', {
  //   workflowId,
  //   executionId,
  //   nodeId: node.id,
  //   status: 'executing_tool',
  //   toolName: tc.name,
  //   toolCallId: tc.id,
  // });

  let toolContent;

  if (tc.name === 'recall_memory' && commonAiData.memoryWorkflowId) {
    // Native child workflow — releases Activity slot during wait
    log.info('[AINode] Dispatching recall_memory as child workflow', {
      query: tc.args?.query,
      memoryWorkflowId: commonAiData.memoryWorkflowId,
    });
    const recallWorkflowId = `e_${(executionId || 'x').substring(0, 8)}:recall:r_${aiRound}`;
    try {
      const recallResult = await executeChild('runWorkflow', {
        workflowId: recallWorkflowId,
        args: [
          commonAiData.memoryWorkflowId,
          {
            appId: commonAiData.appId,
            query: tc.args?.query || '',
            sessionId: commonAiData.sessionId,
            userId: commonAiData.userId,
            triggeredBy: commonAiData.userId,
            parentExecutionId: executionId,
          },
          recallWorkflowId, // Pass the same unique ID to DB
        ],
      });
      console.log('===> recallResult', JSON.stringify(recallResult, null, 2));
      const context = recallResult?.end?.result?.outputs
        ?.map((item) => {
          return item.value;
        })
        .join('\n');

      toolContent =
        context ||
        recallResult?.end?.result?.result ||
        recallResult?.fetch?.result?.contextString ||
        recallResult?.fetch?.result?.plainText ||
        recallResult?.content ||
        'No relevant memories found.';
    } catch (err) {
      log.warn('[AINode] Memory child workflow failed, using empty fallback', { err: err.message });
      toolContent = 'No relevant memories found.';
    }
  } else {
    // 2. Regular Skill: Determine if it should run as a child workflow or a standard Activity
    const skillMeta = turnResult.skillMap?.[tc.name];

    if (skillMeta?.type === 'WORKFLOW') {
      // RUN AS CHILD WORKFLOW: Releases activity slot and allows full observability
      log.info('[AINode] Dispatching WORKFLOW skill as child workflow', {
        toolName: tc.name,
        skillId: skillMeta.id,
      });

      try {
        const skillWorkflowId = `e_${executionId.substring(0, 8)}:wf_${tc.name}:r_${aiRound}`;
        const childWFResult = await executeChild('runWorkflow', {
          workflowId: skillWorkflowId,
          args: [
            skillMeta.id,
            {
              ...tc.args,
              triggeredBy: commonAiData.userId,
              appId: commonAiData.appId,
              orgId: commonAiData.orgId,
              parentExecutionId: executionId,
              masterSystemPrompt: turnResult.enhancedPrompt,
            },
            skillWorkflowId, // Pass the same unique ID to DB
          ],
        });

        // Workflow skills return a results map. We usually want the main 'content'/output
        // but to maintain compatibility with SkillService behavior, we return the data as-is if it's a string,
        // or try to find a meaningful output.
        const output =
          childWFResult?.end?.result?.result ||
          childWFResult?.content ||
          childWFResult?.result ||
          childWFResult;
        toolContent = typeof output === 'string' ? output : JSON.stringify(output);
      } catch (err) {
        log.warn('[AINode] Skill child workflow failed', { tool: tc.name, err: err.message });
        toolContent = `Error executing workflow tool ${tc.name}: ${err.message}`;
      }
    } else if (skillMeta?.type === 'DIGITAL_EMPLOYEE') {
      log.info('[AINode] Dispatching DIGITAL_EMPLOYEE skill as child workflow', {
        toolName: tc.name,
        skillId: skillMeta.id,
      });

      try {
        // 1. Fetch config (Non-blocking sub-second activity)
        const config = await acts.prepareDigitalEmployeeConfig({
          employeeId: skillMeta.implementationRef,
          message: tc.args.message,
          triggerData: {
            ...commonAiData,
            parentExecutionId: executionId,
          }
        });

        const safeName = skillMeta.empName ? skillMeta.empName.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '') : 'employee';
        const safeRole = skillMeta.empRoleTitle ? skillMeta.empRoleTitle.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '') : '';
        const empInfo = safeRole ? `${safeName}_${safeRole}` : safeName;
        const empWorkflowId = `e_${executionId.substring(0, 8)}:del_${empInfo}:r_${aiRound}`;

        // 2. Execute natively as a Temporal Child Workflow
        // 显式注入 parentExecutionId，确保子工作流内的 addMessage 发出的 session:ready
        // 事件能被主 UnifiedChatService 的 isMatched(data.parentExecutionId === executionId) 命中
        const childMergedData = { ...config.mergedData, parentExecutionId: executionId };
        log.info('[AINode] DIGITAL_EMPLOYEE launching child workflow', {
          empWorkflowId,
          parentExecutionId: executionId,
          brainWorkflowId: config.brainWorkflowId,
          mergedDataKeys: Object.keys(childMergedData),
          childMergedDataParentExecutionId: childMergedData.parentExecutionId,
        });
        const childWFResult = await executeChild('runWorkflow', {
          workflowId: empWorkflowId,
          args: [
            config.brainWorkflowId,
            childMergedData,
            empWorkflowId, // Execution ID
          ],
        });

        // 3. Extract the response text
        const output =
          childWFResult?.end?.result?.result ||
          childWFResult?.content ||
          childWFResult?.result ||
          childWFResult;
          
        toolContent = typeof output === 'string' ? output : JSON.stringify(output);
      } catch (err) {
        log.warn('[AINode] DIGITAL_EMPLOYEE child workflow failed', { tool: tc.name, err: err.message });
        toolContent = `Error delegating to teammate ${tc.name}: ${err.message}`;
      }
    } else {
      // STANDARD ACTIVITY: Fallback for CODE, PACKAGE_SKILL, MCP, etc.
      try {
        const skillResult = await acts.executeSkillTool(
          {
            skillName: tc.name,
            skillId: skillMeta?.id,
            args: tc.args,
            ...commonAiData,
            enhancedPrompt: turnResult.enhancedPrompt,
            parentToolCallId: tc.id, // Explicitly pass the ID of the tool call
          },
          node.id,
          workflowId,
        );
        toolContent = skillMeta?.hideResult
          ? '[Task completed. Output was streamed. Do NOT repeat.]'
          : typeof skillResult === 'string'
            ? skillResult
            : JSON.stringify(skillResult);
      } catch (err) {
        log.warn('[AINode] Skill tool failed', { tool: tc.name, err: err.message });
        toolContent = `Error executing tool ${tc.name}: ${err.message}`;
      }
    }
  }

  // 核心：在执行后通知前端工具结果 (统一使用 tool-result 中划线坐标)
  const displayMode = getToolDisplayMode(tc.name);
  if (commonAiData.outputMode !== 'silent' && displayMode !== 'name-only') {
    await acts.emitActivityEvent('node:progress', {
      workflowId,
      executionId,
      nodeId: node.id,
      status: 'tool-result',
      toolName: tc.name,
      toolCallId: tc.id,
      result: toolContent,
      parentExecutionId: commonAiData.parentExecutionId,
    });
  }

  return toolContent;
}
