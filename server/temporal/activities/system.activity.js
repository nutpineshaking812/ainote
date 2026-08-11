import WorkflowRepository from '../../repositories/workflow.repository.js';
import { WorkflowExecutionRepository } from '../../repositories/workflowExecution.repository.js';
import workflowEvents from '../../services/workflow.events.js';
import registryService from '../../services/workflow/registry.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { Context } from '@temporalio/activity';
import pluginService from '../../services/plugin.service.js';
import { ApplicationFailure } from '@temporalio/workflow';
import { logger } from '../../config/logger.js';

/**
 * Emit an event to the global event hub (used by workflows to notify SSE)
 */
export const emitActivityEvent = async (event, data) => {
  workflowEvents.emit(event, data);
};

/**
 * 活动：发送自定义 SSE 事件
 */
export const handleSendSSEEvent = async (params) => {
  const { workflowId, executionId, nodeId, status = 'custom_event', ...payload } = params;

  if (!workflowId) {
    logger.warn('[system.activity] Missing workflowId in handleSendSSEEvent');
    return { success: false };
  }

  workflowEvents.emit('node:progress', {
    workflowId: workflowId.toString(),
    executionId: executionId?.toString(),
    sessionId: payload.sessionId || payload.triggerData?.sessionId,
    parentExecutionId: payload.parentExecutionId,
    nodeId,
    status,
    ...payload,
  });

  return { success: true };
};

export const validateWorkflow = async (workflowData, triggerData) => {
  if (!workflowData || !workflowData.nodes || workflowData.nodes.length === 0) {
    return { valid: false, reason: 'Workflow has no nodes' };
  }

  const hasEndNode = (workflowData.nodes || []).some((n) => n.type === 'end');
  if (!hasEndNode) {
    return { valid: false, reason: 'Workflow must have at least one "End" node.' };
  }

  if (workflowData.scope !== 'SYSTEM' && !workflowData.organizationId) {
    return { valid: false, reason: 'Workflow missing organization context' };
  }

  // 3. User permission/quota check
  const userId = triggerData?.triggeredBy;
  if (!userId && workflowData.scope !== 'SYSTEM') {
    return { valid: false, reason: 'Missing user context (triggeredBy)' };
  }

  logger.info(
    { workflowId: workflowData.id },
    'Workflow validation passed',
  );
  return { valid: true };
};

export const createExecutionRecord = async (
  workflowId,
  organizationId,
  triggerData,
  executionId = null,
) => {
  try {
    // [IDEMPOTENCY] If executionId is provided, check if it already exists to avoid primary key conflicts on retry
    if (executionId) {
      // Check both database and registry fallback if needed, but repository findById is sufficient for executions
      const existing = await WorkflowExecutionRepository.findById(executionId);
      if (existing) {
        logger.info({ executionId }, '[system.activity] Execution record already exists, returning.');
        return existing.id.toString();
      }
    }

    const data = {
      workflowId: workflowId.toString(),
      organizationId: (organizationId || triggerData.orgId)?.toString(),
      triggeredBy: triggerData.triggeredBy?.toString(),
      triggerData: {
        ...triggerData,
        triggeredAt: triggerData.triggeredAt || new Date(),
      },
    };

    if (executionId) data.id = executionId;

    const execution = await WorkflowExecutionRepository.create(data);

    const finalExecutionId = execution.id.toString();
    const sessionId = triggerData?.sessionId;

    workflowEvents.emit('workflow:start', {
      workflowId: workflowId.toString(),
      executionId: finalExecutionId,
      sessionId,
      parentExecutionId: triggerData?.parentExecutionId,
    });

    return finalExecutionId;
  } catch (err) {
    logger.error({ err, workflowId }, 'Failed to create execution record in activity');
    throw err;
  }
};

export const updateExecutionStatus = async (executionId, update) => {
  try {
    const execution = await WorkflowExecutionRepository.update(executionId, {
      ...update,
      updatedAt: new Date()
    });

    if (!execution) {
      logger.error({ executionId }, 'Execution not found in updateExecutionStatus');
      return null;
    }

    const realWorkflowId = execution.workflowId.toString();
    const realExecutionId = execution.id.toString();
    const sessionId = execution.triggerData?.sessionId;

    if (update.status === 'SUCCESS') {
      workflowEvents.emit('workflow:success', {
        workflowId: realWorkflowId,
        executionId: realExecutionId,
        sessionId,
        parentExecutionId: execution.triggerData?.parentExecutionId,
      });
    } else if (update.status === 'FAILED') {
      workflowEvents.emit('workflow:error', {
        workflowId: realWorkflowId,
        executionId: realExecutionId,
        sessionId,
        parentExecutionId: execution.triggerData?.parentExecutionId,
        error: update.error?.message,
      });
    }

    return execution;
  } catch (err) {
    logger.error({ executionId, err }, 'Failed to update workflow execution status in activity');
    throw err;
  }
};

export const handleLog = async (data, nodeId, workflowId) => {
  const message = typeof data === 'string' ? data : data.message || JSON.stringify(data);
  return { message, loggedAt: new Date().toISOString() };
};

export const handleWebhook = async (data, nodeId, workflowId) => {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    query: {},
    body: data.mockBody || {},
    triggeredAt: new Date().toISOString(),
  };
};

export const getWorkflowDef = async (workflowId, appId = null) => {
  try {
    // 1. Try database lookup (Repository handles format validation internally)
    const workflow = await WorkflowRepository.findById(workflowId);
    if (workflow) return workflow;

    // 2. Registry Fallback (Handles built-in templates and system keys)
    const key = (workflowId || '').toString().replace('system_', '');
    const fallback = await registryService.getWorkflowByKey(key, appId);
    if (fallback) return fallback;

    throw ApiError.notFound(`Workflow definition not found: ${workflowId}`);
  } catch (err) {
    logger.error({ err, workflowId, appId }, '[Activity] Failed to get workflow definition');
    throw err;
  }
};

/**
 * 核心插件执行接口
 * 职责：加载并执行 workflow/plugins/ 下的自定义逻辑
 */
export const handlePluginAction = async (pluginId, params, ctx) => {
  try {
    // 构造带运行时信息的执行上下文 (Execution Context)
    const execCtx = await pluginService.getExecutionContext(pluginId, ctx);
    if (!execCtx) {
      const status = pluginService.getPluginsStatus(pluginId)[pluginId];
      const detail = status?.error ? ` (Load error: ${status.error})` : '';
      throw new Error(`Failed to create execution context for plugin: ${pluginId}${detail}`);
    }

    const handler = pluginService.getHandler(pluginId);
    if (!handler) {
      throw new Error(`Plugin handler not found: ${pluginId}`);
    }

    // 执行插件自带的逻辑
    logger.info({ pluginId }, '[system.activity] Executing plugin');
    const result = await handler(params, execCtx);
    if (!result.success) {
      throw ApplicationFailure.create({
        message: `${result.error}`,
        type: 'PluginError',
        nonRetryable: true,
      });
    }
    return result;
  } catch (err) {
    logger.error({ err: err.stack || err.message || err, pluginId }, '[system.activity] Plugin execution failed');
    throw ApplicationFailure.create({
      message: err.message || `${err}`,
      type: 'PluginError',
      nonRetryable: true,
    });
  }
};
/**
 * 核心优化：合并初始化逻辑 (Bootstrapping)
 * 一次性完成：获取定义 -> 校验 -> 创建执行记录
 */
export const initializeWorkflow = async (params) => {
  const { workflowRef, triggerData, executionId: providedId } = params;
  
  // 1. Resolve Workflow Definition
  let workflowData;
  let workflowId = null;
  if (typeof workflowRef === 'string') {
    workflowId = workflowRef;
  } else if (workflowRef && typeof workflowRef === 'object') {
    workflowId = workflowRef.id || workflowRef._id;
  }

  if (!workflowId && workflowRef?.nodes && workflowRef?.edges) {
    workflowData = workflowRef;
    if (!workflowData._id) workflowData._id = 'anonymous';
  } else {
    workflowData = await getWorkflowDef(workflowId, triggerData?.appId);
  }

  // 2. Pre-flight Validation
  const validation = await validateWorkflow(workflowData, triggerData);
  if (!validation.valid) {
    return { success: false, reason: validation.reason };
  }

  // 3. Execution Record (if not anonymous)
  let executionId = providedId;
  const isAnonymous = executionId && executionId.startsWith('trial-');
  
  if (!isAnonymous) {
    executionId = await createExecutionRecord(
      workflowData._id,
      workflowData.organizationId,
      triggerData,
      executionId
    );
  }

  return {
    success: true,
    workflowData,
    executionId,
    isAnonymous
  };
};

export const appendNodeResult = async (executionId, nodeId, nodeRecord) => {
  try {
    return await WorkflowExecutionRepository.appendNodeResult(executionId, nodeId, nodeRecord);
  } catch (err) {
    logger.error({ err, executionId, nodeId }, 'Failed to append node result to DB activity');
    throw err;
  }
};
