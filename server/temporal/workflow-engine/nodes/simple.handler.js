/**
 * workflow-engine/nodes/simple.handler.js
 *
 * Handles "simple" one-liner node types that just call an Activity and return.
 * Each case maps directly to a single proxyActivities call.
 *
 * ctx provides: { node, triggerData, workflowData, workflowId, executionId, acts, localActs }
 */
import { sleep } from '@temporalio/workflow';

export async function handleSimpleNode(node, resolvedData, ctx) {
  const { triggerData, workflowData, workflowId, executionId, acts, localActs } = ctx;
  let result = null;

  switch (node.type) {
    // ── Notifications & I/O ──────────────────────────────────────────────────
    case 'notification':
      result = await localActs.handleNotification(resolvedData, node.id, workflowData._id);
      break;
    case 'log':
      result = await localActs.handleLog(resolvedData, node.id, workflowData._id);
      break;
    case 'sendSseEvent':
      result = await localActs.handleSendSSEEvent({
        ...resolvedData,
        workflowId,
        executionId,
        nodeId: node.id,
      });
      break;
    case 'dingTalkRobot':
      result = await acts.handleDingTalkRobot(resolvedData, node.id, workflowData._id);
      break;

    // ── Conversation ─────────────────────────────────────────────────────────
    case 'addMessage':
      console.log('TRACE_AINOTE simple.handler handleSimpleNode addMessage node:', {
        resolvedData,
        workflowId,
        executionId,
      });
      result = await acts.addMessage({
        ...resolvedData,
        workflowId,
        executionId,
        parentExecutionId: triggerData?.parentExecutionId,
        content:
          resolvedData.content || triggerData?.message || triggerData?.content || '(No Content)',
        conversationId: resolvedData.conversationId || triggerData?.conversationId,
      });
      break;
    case 'convPrepare':
      console.log('TRACE_AINOTE simple.handler handleSimpleNode convPrepare node:', {
        resolvedData,
        workflowId,
        executionId,
      });
      result = await acts.prepareConversation({
        ...resolvedData,
        userId: triggerData?.triggeredBy || resolvedData.userId,
        appId: triggerData?.appId || workflowData?.appId || resolvedData.appId,
        orgId: triggerData?.orgId || workflowData?.organizationId,
        targetId: resolvedData.targetId || triggerData?.targetId,
        employeeId: resolvedData.employeeId || triggerData?.employeeId,
        scenario: resolvedData.scenario || triggerData?.scenario,
        workflowId,
        executionId,
      });
      break;

    // ── Memory ─────────────────────────────────────────────────────────────
    case 'fetchMemory': {
      // Configuration-Only for AI memory-slot optimization
      const conversationId = resolvedData.conversationId || triggerData?.conversationId;
      result = {
        conversationId,
        limit: resolvedData.limit,
        afterTime: resolvedData.afterTime,
      };
      break;
    }
    case 'loadMemory': {
      const conversationId = resolvedData.conversationId || triggerData?.conversationId;
      result = await acts.loadMemory({
        conversationId,
        limit: resolvedData.limit,
        afterTime: resolvedData.afterTime,
      });
      break;
    }
    case 'updateDocSection':
    case 'upsertMemorySection':
      result = await acts.upsertMemorySection({
        ...resolvedData,
        userId: triggerData?.triggeredBy,
        appId: triggerData?.appId || workflowData?.appId,
        sessionId: resolvedData.sessionId || triggerData?.sessionId,
        sessionName: resolvedData.sessionName || triggerData?.sessionName,
      });
      break;
    case 'fetchDocSection':
    case 'fetchMemorySection':
      result = await acts.fetchMemorySection({
        results: resolvedData.results,
        userId: triggerData?.triggeredBy || resolvedData.userId,
      });
      break;
    case 'fetchRecentSnapshots':
      result = await acts.fetchRecentSnapshots({
        appId: triggerData?.appId,
        sessionId: triggerData?.sessionId,
        ...resolvedData,
      });
      break;
    case 'getExecutionLogs':
      result = await acts.getExecutionLogs({
        appId: triggerData?.appId,
        sessionId: triggerData?.sessionId,
        ...resolvedData,
      });
      break;
    case 'getMemoryHeaders':
      result = await acts.getMemoryHeaders({
        appId: triggerData?.appId,
        sessionId: triggerData?.sessionId,
        sessionName: triggerData?.sessionName,
        ...resolvedData,
      });
      break;


    // ── Data / Analytics ─────────────────────────────────────────────────────
    case 'vectorIndex':
      result = await acts.vectorIndex({
        ...resolvedData,
        appId: triggerData?.appId,
        userId: triggerData?.triggeredBy || workflowData.createdBy,
        sessionId: triggerData?.sessionId,
        sessionName: triggerData?.sessionName,
      });
      break;
    case 'vectorSearch':
      result = await acts.vectorSearch({
        appId: triggerData?.appId,
        sessionId: triggerData?.sessionId,
        ...resolvedData,
      });
      break;

    // ── Resources ────────────────────────────────────────────────────────────
    case 'fetchResource':
      result = await acts.handleFetchResources(resolvedData, node.id, workflowData._id);
      break;

    // ── BlockNote ────────────────────────────────────────────────────────────
    case 'blocknoteOneShot':
      result = await acts.handleBlockNoteAction(
        {
          ...resolvedData,
          nodeId: node.id,
          userId: triggerData?.triggeredBy || resolvedData.userId,
          appId: triggerData?.appId || workflowData?.appId || resolvedData.appId,
          orgId: triggerData?.orgId || workflowData?.organizationId,
          executionId: executionId || workflowId,
        },
        workflowId,
      );
      break;

    // ── Skills ───────────────────────────────────────────────────────────────
    case 'skillNode':
      // Addon node providing skill IDs — just pass through config as state
      result = { skillIds: resolvedData.skillIds, label: resolvedData.label };
      break;
    case 'skillAction':
      result = await acts.handleSkillAction(resolvedData, node.id, workflowData._id);
      break;
    case 'recallKnowledge':
      // Addon node providing a memory-search subworkflow
      result = { workflowId: resolvedData.workflowId, label: resolvedData.label };
      break;
    case 'plugin-trigger':
    case 'plugin-action': {
      // ✨ 核心逻辑：执行三方插件
      const pluginRes = await acts.handlePluginAction(
        resolvedData.pluginId,
        resolvedData.pluginParams || resolvedData,
        {
          triggerData,
          workflowData: { _id: workflowData._id, appId: workflowData.appId },
          executionId,
          nodeId: node.id,
          edges: ctx.edges,
          nodeResults: Object.fromEntries(ctx.nodeResults),
        },
      );
      // 通用 sleep 能力：插件返回 __sleepAfter 标识时，使用 Temporal 原生 sleep 挂起
      await maybeSleep(pluginRes);
      return {
        result: pluginRes?.result !== undefined ? pluginRes.result : pluginRes,
        nextHandleId: pluginRes?.nextHandleId || null,
      };
    }

    // ── Default ──────────────────────────────────────────────────────────────
    default:
      // ✨ 兜底逻辑：尝试将节点类型直接作为插件 ID 执行
      try {
        const pluginRes = await acts.handlePluginAction(
          node.type,
          resolvedData,
          {
            triggerData,
            workflowData: { _id: workflowData._id, appId: workflowData.appId },
            executionId,
            nodeId: node.id,
            edges: ctx.edges,
            nodeResults: Object.fromEntries(ctx.nodeResults),
          }
        );
        // 通用 sleep 能力：同 plugin-action
        await maybeSleep(pluginRes);
        return {
          result: pluginRes?.result !== undefined ? pluginRes.result : pluginRes,
          nextHandleId: pluginRes?.nextHandleId || null,
        };
      } catch (err) {
        // 如果插件不存在或执行失败且非严重错误，则保持原有的默认行为
        return { result: { triggeredAt: new Date().toISOString(), ...resolvedData } };
      }
  }
  return { result };
}

/**
 * 通用 sleep 能力
 * 任何插件在返回结果中携带 `__sleepAfter` 字段（秒数）时，
 * workflow 层会使用 Temporal 原生 sleep() 挂起，不占用 Activity Worker 线程。
 *
 * @param {Object} pluginRes - 插件 handler 的返回值
 */
async function maybeSleep(pluginRes) {
  if (!pluginRes || pluginRes.__sleepAfter == null) return;
  const seconds = Math.max(1, Math.min(300, Number(pluginRes.__sleepAfter) || 5));
  await sleep(seconds * 1000);
}
