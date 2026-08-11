import asyncHandler from 'express-async-handler';
import workflowService from '../services/workflow.service.js';
import skillService from '../services/skill.service.js';
import workflowScheduler from '../services/workflow.scheduler.js';
import { WorkflowExecutionRepository } from '../repositories/workflowExecution.repository.js';
// Removed Mongoose model imports
import { getTemporalClient } from '../temporal/client.js';
import env from '../config/env.js';
import { AgentEventEmitter } from '../utils/eventEmitter.js';
import { ProtocolStreamer } from '../utils/stream.protocol.js';
import { logger } from '../config/logger.js';
import pluginService from '../services/plugin.service.js';

import { resolveVariables } from '../utils/workflow.resolver.js';
import * as activities from '../temporal/activities.js';
import { sendSuccess } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import {
  validateWorkflowInput,
  validateWorkflowStructure,
} from '../services/workflow/validator.service.js';
import { mergeTriggerDefaults } from '../utils/workflowUtils.js';

export const getWorkflowInterface = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const workflow = await workflowService.getWorkflowById(req.headers['x-organization-id'], id);

  if (!workflow) {
    return res.status(404).json({ success: false, message: 'Workflow not found' });
  }

  // 提取触发器节点和结束节点
  const triggerNode = workflow.nodes?.find((n) =>
    [
      'manual',
      'click',
      'webhook',
      'schedule',
      'dataChange',
      'capability',
      'dingtalk_trigger',
      'plugin-trigger',
    ].includes(n.type),
  );
  const endNode = workflow.nodes?.find((n) => n.type === 'end');

  sendSuccess(res, {
    inputs: triggerNode?.data?.inputs || triggerNode?.data?.params || [],
    outputs: endNode?.data?.outputs || endNode?.data?.mapping || [],
    triggerType: triggerNode?.type,
    name: workflow.name,
  });
});

// Helper to extract skill config from nodes (looking for Webhook or Click nodes with isSkill: true)
const extractSkillMetadata = (nodes) => {
  if (!Array.isArray(nodes)) return null;
  const skillSource = nodes.find(
    (n) => (n.type === 'webhook' || n.type === 'click') && n.data?.isSkill,
  );

  if (!skillSource) return null;

  const skillConfig = {
    name: skillSource.data.toolName || 'unnamed_tool',
    description: skillSource.data.description || '',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    outputSchema: {
      type: 'object',
      properties: {},
    },
  };

  // Map input parameters
  if (skillSource.data.inputParameters) {
    skillSource.data.inputParameters.forEach((param) => {
      skillConfig.inputSchema.properties[param.name] = {
        type: param.type || 'string',
        description: param.description || '',
      };
      if (param.required) {
        skillConfig.inputSchema.required.push(param.name);
      }
    });
  }

  // Map output parameters
  if (skillSource.data.outputParameters) {
    skillSource.data.outputParameters.forEach((param) => {
      skillConfig.outputSchema.properties[param.name] = {
        type: param.type || 'string',
        description: param.description || '',
      };
    });
  }

  return {
    config: skillConfig,
    triggerType: skillSource.type === 'webhook' ? 'WEBHOOK' : 'MANUAL',
  };
};

const createWorkflow = asyncHandler(async (req, res) => {
  // 1. Mandatory structural validation (End node, Trigger node)
  const structuralValidation = validateWorkflowStructure(req.body);
  if (!structuralValidation.valid) {
    throw new ApiError(ERROR_CODES.WORKFLOW_VALIDATION_FAIL, structuralValidation.error);
  }

  // Auto-extract skill config if a Webhook or Click Node with isSkill is present
  const skillInfo = extractSkillMetadata(req.body.nodes);
  if (skillInfo) {
    req.body.isSkill = true;
    req.body.skillConfig = skillInfo.config;
    // Ensure triggerType is consistent if not explicitly provided
    if (!req.body.triggerType) {
      req.body.triggerType = skillInfo.triggerType;
    }
  }

  // Force scope to APP for all new workflows
  // Users must explicitly use the "Publish" action to promote it to ORGANIZATION
  req.body.scope = 'APP';

  const workflow = await workflowService.createWorkflow(
    req.user._id,
    req.headers['x-organization-id'],
    req.body,
  );
  if (workflow.triggerType === 'SCHEDULE') {
    await workflowScheduler.sync(workflow._id);
  }

  sendSuccess(res, workflow, 201);
});

const getWorkflows = asyncHandler(async (req, res) => {
  const workflows = await workflowService.getWorkflows(req.headers['x-organization-id'], req.query);
  sendSuccess(res, workflows);
});

const getWorkflowById = asyncHandler(async (req, res) => {
  const workflow = await workflowService.getWorkflowById(
    req.headers['x-organization-id'],
    req.params.id,
    { appId: req.query.appId },
  );
  sendSuccess(res, workflow);
});

const updateWorkflow = asyncHandler(async (req, res) => {
  // 1. Mandatory structural validation (only if nodes are being updated)
  if (req.body.nodes) {
    const structuralValidation = validateWorkflowStructure(req.body);
    if (!structuralValidation.valid) {
      throw new ApiError(ERROR_CODES.WORKFLOW_VALIDATION_FAIL, structuralValidation.error);
    }
  }

  let { id } = req.params;
  const orgId = req.headers['x-organization-id'];

  // Handle virtual or real database ID for system workflows
  let targetWorkflow = null;
  if (id.startsWith('system_')) {
    const key = id.replace('system_', '');
    const workflowRegistryService = (await import('../services/workflow/registry.service.js'))
      .default;
    targetWorkflow = await workflowRegistryService.getWorkflowByKey(
      key,
      req.body.appId || req.query.appId,
    );

    if (!targetWorkflow) {
      return res.status(404).json({ success: false, message: 'System workflow not found' });
    }
    if (!targetWorkflow.isCustomized) {
      // Attempting to modify a global system default -> Copy-on-Write
      const appId = req.body.appId || req.query.appId;
      const organizationId = orgId || req.body.organizationId || targetWorkflow.organizationId;

      if (appId || organizationId) {
        const workflowData = {
          ...req.body,
          workflowKey: targetWorkflow.workflowKey,
          organizationId: organizationId,
          createdBy: req.user._id.toString(),
          scope: 'SYSTEM',
          appId: appId || null,
        };
        const newWorkflow = await workflowService.createSystemOverride(
          req.user._id.toString(),
          organizationId,
          workflowData,
        );
        return sendSuccess(res, newWorkflow);
      } else {
        return res.status(403).json({
          success: false,
          message:
            'Cannot modify global system workflow directly without app or organization context',
        });
      }
    } else {
      id = targetWorkflow._id.toString();
    }
  } else {
    targetWorkflow = await workflowService.getWorkflowById(orgId, id);
  }

  // Fetch original workflow state to check for trigger type changes
  const oldWorkflow = await workflowService.getWorkflowById(orgId, id);

  // Auto-extract skill config if a Webhook or Click Node with isSkill is present in update
  const skillInfo = extractSkillMetadata(req.body.nodes);
  if (skillInfo) {
    req.body.isSkill = true;
    req.body.skillConfig = skillInfo.config;
    // Update trigger type if enabling skill on a specific node
    req.body.triggerType = skillInfo.triggerType;
  }

  const workflow = await workflowService.updateWorkflow(
    req.headers['x-organization-id'],
    id,
    req.body,
  );

  // Only sync with scheduler if:
  // 1. Current type is SCHEDULE (needs update/create)
  // 2. Old type was SCHEDULE (needs deletion)
  if (
    workflow.triggerType === 'SCHEDULE' ||
    (oldWorkflow && oldWorkflow.triggerType === 'SCHEDULE')
  ) {
    await workflowScheduler.sync(workflow._id);
  }

  // Sync plugins for update (Enable/Disable connections based on status)
  const pluginsInUpdate = Array.from(
    new Set(
      workflow.nodes
        .filter((n) => ['plugin-trigger', 'plugin-action'].includes(n.type))
        .map((n) => n.data?.pluginId)
        .filter(Boolean),
    ),
  );

  for (const pid of pluginsInUpdate) {
    try {
      await pluginService.reloadPlugin(pid);
    } catch (e) {
      logger.error(`Failed to reload plugin ${pid} on workflow update: ${e.message}`);
    }
  }

  sendSuccess(res, workflow);
});

const deleteWorkflow = asyncHandler(async (req, res) => {
  const workflowId = req.params.id;

  // Before deleting, find if it had plugins to notify them to disconnected
  const wf = await workflowService.getWorkflowById(req.headers['x-organization-id'], workflowId);
  const pluginIds = wf?.nodes
    ? Array.from(
        new Set(
          wf.nodes
            .filter((n) => ['plugin-trigger', 'plugin-action'].includes(n.type))
            .map((n) => n.data?.pluginId)
            .filter(Boolean),
        ),
      )
    : [];

  await workflowScheduler.unschedule(workflowId);
  await workflowService.deleteWorkflow(req.headers['x-organization-id'], workflowId);

  // Reload plugins to drop the deleted workflow from their scan
  for (const pid of pluginIds) {
    try {
      await pluginService.reloadPlugin(pid);
    } catch (e) {
      logger.error(`Failed to reload plugin ${pid} on workflow deletion: ${e.message}`);
    }
  }

  sendSuccess(res, null);
});

const executeWorkflow = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = req.headers['x-organization-id'];
  let workflow = null;

  if (id.startsWith('system_')) {
    const key = id.replace('system_', '');
    const workflowRegistryService = (await import('../services/workflow/registry.service.js'))
      .default;
    workflow = await workflowRegistryService.getWorkflowByKey(
      key,
      req.body.appId || req.query.appId,
    );
  } else {
    workflow = await workflowService.getWorkflowById(orgId, id, {
      allowCrossOrg: true,
      userId: req.user?._id?.toString(),
      appId: req.body.appId || req.query.appId,
    });
  }

  if (!workflow) {
    return res.status(404).json({ success: false, message: 'Workflow not found' });
  }

  const client = await getTemporalClient();

  const appId = req.body.appId || req.query.appId;
  const triggerType =
    req.body.data && workflow.triggerType === 'CAPABILITY' ? 'CAPABILITY' : 'MANUAL';
  const clientPlatform = req.headers['x-client-platform'] || '';

  const triggerData = {
    ...(req.body.data || {}),
    appId: appId || workflow.appId,
    orgId: orgId || workflow.organizationId,
    triggeredBy: req.user._id?.toString(),
    triggerType,
    triggeredAt: new Date(),
    clientPlatform,
  };

  // 1. Validate inputs before ANY execution starts
  mergeTriggerDefaults(workflow.nodes, triggerData);
  const { validateWorkflowInput } = await import('../services/workflow/validator.service.js');
  const validation = validateWorkflowInput(workflow, triggerData);
  if (!validation.valid) {
    throw new ApiError(ERROR_CODES.WORKFLOW_VALIDATION_FAIL, validation.error);
  }

  const execution = await workflowService.createExecution({
    workflowId: workflow.id || workflow._id,
    appId: triggerData.appId,
    organizationId: triggerData.orgId,
    triggeredBy: req.user._id?.toString(),
    resourceId: req.body.data?.documentId || req.body.data?.resourceId,
    resourceType: (req.body.data?.documentId || req.body.data?.resourceId) ? 'DOCUMENT' : undefined,
    triggerData,
  });

  // Trigger Temporal execution
  const executionId = execution.id || execution._id;
  const temporalWorkflowId = `workflow-exec-${executionId.toString()}`;
  const handle = await client.workflow.start('runWorkflow', {
    args: [
      { id: (workflow.id || workflow._id).toString() },
      execution.triggerData,
      executionId.toString(),
    ],
    taskQueue: env.TEMPORAL_TASK_QUEUE,
    workflowId: temporalWorkflowId,
  });

  // Update with Temporal info
  await WorkflowExecutionRepository.update(executionId, {
    temporalWorkflowId: temporalWorkflowId,
    temporalRunId: handle.runId,
  });

  const workflowEvents = (await import('../services/workflow.events.js')).default;
  workflowEvents.emit('workflow:start', { workflowId: workflow._id });

  sendSuccess(res, {
    message: 'Workflow execution started via Temporal',
    workflowId: handle.workflowId,
    runId: handle.runId,
    executionId: execution._id,
  });
});

const streamWorkflowEvents = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Initialize AgentEventEmitter
  const sse = new AgentEventEmitter(res);
  sse.startHeartbeat();

  // Set standard SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 关键：禁用 Nginx 缓存，防止远程机器上大载荷事件被拦截丢弃
  res.flushHeaders();

  const workflowEvents = (await import('../services/workflow.events.js')).default;

  const sendEvent = (event, data) => {
    // Only send events for this specific workflow
    console.log('====> Sending event', event, data, id);
    if (data.workflowId) {
      const incomingId = data.workflowId.toString();
      if (incomingId !== id && !incomingId.includes(id)) return;
    }

    sse.emit(event, data);
  };

  // Define listeners
  const listeners = {
    'workflow:start': (data) => sendEvent('workflow:start', data),
    'workflow:success': (data) => sendEvent('workflow:success', data),
    'workflow:error': (data) => sendEvent('workflow:error', data),
    'node:start': (data) => sendEvent('node:start', data),
    'node:success': (data) => sendEvent('node:success', data),
    'node:error': (data) => sendEvent('node:error', data),
    'node:progress': (data) => sendEvent('node:progress', data),
  };

  // Attach listeners to the global event hub
  Object.keys(listeners).forEach((event) => {
    workflowEvents.on(event, listeners[event]);
  });

  // Cleanup on connection close
  req.on('close', () => {
    Object.keys(listeners).forEach((event) => {
      workflowEvents.removeListener(event, listeners[event]);
    });
    sse.close();
  });
});

const streamWorkflow = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = req.headers['x-organization-id'];
  let workflow = null;

  if (id.startsWith('system_')) {
    const key = id.replace('system_', '');
    const workflowRegistryService = (await import('../services/workflow/registry.service.js'))
      .default;
    workflow = await workflowRegistryService.getWorkflowByKey(
      key,
      req.body.appId || req.query.appId,
    );
  } else {
    workflow = await workflowService.getWorkflowById(orgId, id, {
      allowCrossOrg: true,
      userId: req.user?._id?.toString(),
      appId: req.body.appId || req.query.appId,
    });
  }

  if (!workflow) {
    return res.status(404).json({ success: false, message: 'Workflow not found' });
  }

  const appId = req.body.appId || req.query.appId;
  const triggerType =
    req.body?.data && workflow.triggerType === 'CAPABILITY' ? 'CAPABILITY' : 'MANUAL_STREAM';
  const clientPlatform = req.headers['x-client-platform'] || '';

  // 1. Prepare trigger data early (before starting SSE)
  const triggerData = {
    ...(req.body.data || {}),
    appId: appId || workflow.appId,
    orgId: orgId || workflow.organizationId,
    triggeredBy: req.user._id,
    triggerType,
    triggeredAt: new Date(),
    clientPlatform,
  };

  // 2. Validate inputs before ANY response headers are sent
  mergeTriggerDefaults(workflow.nodes, triggerData);
  const inputValidation = validateWorkflowInput(workflow, triggerData);
  if (!inputValidation.valid) {
    throw new ApiError(ERROR_CODES.WORKFLOW_VALIDATION_FAIL, inputValidation.error);
  }

  // 3. From here on, we transition to SSE/Stream protocol (Success)
  const streamer = new ProtocolStreamer(res);
  streamer.startHeartbeat();
  logger.info({ workflowId: workflow._id }, 'Starting SSE stream for workflow execution');

  const client = await getTemporalClient();
  const execution = await workflowService.createExecution({
    workflowId: workflow.id || workflow._id,
    appId: triggerData.appId,
    organizationId: triggerData.orgId,
    triggeredBy: req.user._id?.toString(),
    resourceId: req.body.data?.documentId || req.body.data?.resourceId,
    resourceType: (req.body.data?.documentId || req.body.data?.resourceId) ? 'DOCUMENT' : undefined,
    triggerData,
  });

  const executionId = (execution.id || execution._id).toString();
  const workflowEvents = (await import('../services/workflow.events.js')).default;

  // 【协议补全】主动发送 Server Actions 协议要求的起始序列
  streamer._emitStart();
  streamer._emitStartStep();

  // Closure wrapper for terminal events
  const sendEvent = (event, data) => {
    // 核心过滤：优先通过 executionId 锁定。支持子工作流事件（通过 parentExecutionId 关联）和共享相同 sessionId 的流式会话事件
    const isTargetExecution = 
      (data.executionId && data.executionId.toString() === executionId) ||
      (data.parentExecutionId && data.parentExecutionId.toString() === executionId) ||
      (triggerData?.sessionId && data.sessionId && data.sessionId.toString() === triggerData.sessionId.toString());

    if (!isTargetExecution) {
      if (data.workflowId) {
        const dbId = workflow._id.toString();
        const incomingId = data.workflowId.toString();
        if (incomingId !== dbId && !incomingId.includes(dbId)) return;
      } else {
        return;
      }
    }

    // 截断过大的 result 字段以不影响 SSE 性能
    let payload = data;
    if (data.result && typeof data.result === 'object') {
      payload = { ...data, result: { ...data.result } };
      if (
        payload.result.data &&
        typeof payload.result.data === 'string' &&
        payload.result.data.length > 5000
      ) {
        payload.result.data = payload.result.data.substring(0, 5000) + '... (truncated)';
      }
    }

    // 对齐工作流事件与协议吸收器
    // 注入 event 类型作为状态判定依据
    streamer.absorbWorkflowEvent({ ...payload, status: payload.status || event });

    // 【协议补全】仅当主工作流结束时，发送结束信号并关闭流
    const isMainTerminal = data.executionId && data.executionId.toString() === executionId;
    if (isMainTerminal && (event === 'workflow:success' || event === 'workflow:error')) {
      const reason = event === 'workflow:success' ? 'stop' : 'error';
      streamer._emitFinishStep(); // 补全步骤闭合信号
      streamer.finish(reason);
      // 清理监听器
      cleanup();
    }
  };

  const listeners = {
    'workflow:start': (data) => sendEvent('workflow:start', data),
    'workflow:success': (data) => sendEvent('workflow:success', data),
    'workflow:error': (data) => sendEvent('workflow:error', data),
    'node:start': (data) => sendEvent('node:start', data),
    'node:success': (data) => sendEvent('node:success', data),
    'node:error': (data) => sendEvent('node:error', data),
    'node:progress': (data) => sendEvent('node:progress', data),
  };

  const cleanup = () => {
    Object.keys(listeners).forEach((event) => {
      workflowEvents.removeListener(event, listeners[event]);
    });
  };

  Object.keys(listeners).forEach((event) => {
    workflowEvents.on(event, listeners[event]);
  });

  // Trigger Temporal execution
  const temporalWorkflowId = `workflow-exec-${executionId}`;
  try {
    const handle = await client.workflow.start('runWorkflow', {
      // Pass ID reference only to keep payload small
      args: [{ id: (workflow.id || workflow._id).toString() }, execution.triggerData, executionId],
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId: temporalWorkflowId,
    });

    // Update with Temporal info
    await WorkflowExecutionRepository.update(executionId, {
      temporalWorkflowId: temporalWorkflowId,
      temporalRunId: handle.runId,
    });

    logger.info(
      { workflowId: workflow._id, runId: `exec-${executionId}`, executionId },
      'Temporal Workflow started from stream',
    );
  } catch (err) {
    logger.error({ err }, 'Failed to start Temporal Workflow');
    streamer.emitError(err.message);
    throw err;
  }

  // Emit start event immediately
  workflowEvents.emit('workflow:start', { workflowId: workflow._id, executionId });

  // 清理监听器
  req.on('close', () => {
    Object.keys(listeners).forEach((event) => {
      workflowEvents.removeListener(event, listeners[event]);
    });
    streamer.close();
  });
});

import workflowTriggerService from '../services/workflow.trigger.service.js';

const handleWebhook = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const execution = await workflowTriggerService.triggerWebhook(id, {
    method: req.method,
    headers: req.headers,
    query: req.query,
    body: req.body,
  });
  sendSuccess(res, {
    message: 'Webhook received and workflow triggered',
    executionId: execution._id,
  });
});

const handleCancelWebhook = asyncHandler(async (req, res) => {
  const { id, executionId } = req.params;
  const result = await workflowTriggerService.cancelWebhook(id, executionId, {
    headers: req.headers,
    query: req.query,
  });
  sendSuccess(res, result);
});

const getAllExecutions = asyncHandler(async (req, res) => {
  const orgId = req.headers['x-organization-id'];
  console.log('[DEBUG] Querying WorkflowExecutions:', { orgId, query: req.query });
  const result = await workflowService.getAllExecutions(orgId, req.query);
  sendSuccess(res, result);
});

const getWorkflowExecutions = asyncHandler(async (req, res) => {
  const result = await workflowService.getWorkflowExecutions(
    req.headers['x-organization-id'],
    req.params.id,
    req.query,
  );
  sendSuccess(res, result);
});

const getExecutionById = asyncHandler(async (req, res) => {
  const execution = await workflowService.getExecutionById(
    req.headers['x-organization-id'],
    req.params.executionId,
  );

  // 1. Sort nodeResults by timestamp (Ascending)
  if (execution.nodeResults && typeof execution.nodeResults === 'object') {
    const entries = Object.entries(execution.nodeResults).sort((a, b) => {
      const timeA = a[1]?.timestamp || 0;
      const timeB = b[1]?.timestamp || 0;
      return timeA - timeB;
    });
    execution.nodeResults = Object.fromEntries(entries);
  }

  // 2. Filter triggerData to specific fields
  if (execution.triggerData) {
    const allowedFields = [
      'appId',
      'orgId',
      'query',
      'channelId',
      'sessionId',
      'triggerType',
      'triggeredAt',
    ];
    execution.triggerData = Object.fromEntries(
      Object.entries(execution.triggerData).filter(([key]) => allowedFields.includes(key)),
    );
  }

  // Cleanup empty error
  if (!execution.error || !execution.error.message) {
    delete execution.error;
  }

  sendSuccess(res, execution);
});

const cancelExecution = asyncHandler(async (req, res) => {
  const result = await workflowService.cancelExecution(
    req.headers['x-organization-id'],
    req.params.executionId,
  );
  sendSuccess(res, result);
});

const debugNode = asyncHandler(async (req, res) => {
  const { nodeType, config, context = {} } = req.body;
  // Ensure basic context for billing/tracking is present
  context.userId = context.userId || req.user._id;
  context.orgId = context.orgId || req.headers['x-organization-id'];
  context.appId = context.appId || req.body.appId || req.query.appId || config.appId;
  context.clientPlatform = context.clientPlatform || req.headers['x-client-platform'] || '';

  if (!nodeType || !config) {
    return res.status(400).json({ success: false, message: 'nodeType and config are required' });
  }

  try {
    // 1. Resolve variables in configuration, excluding static schema metadata (outputs/properties)
    const { outputs, properties, ...cleanConfig } = config;
    const resolvedConfig = await resolveVariables(cleanConfig, context);
    // Inject current user for activities that require it
    resolvedConfig.userId = req.user._id;

    logger.info({ nodeType, resolvedConfig }, 'Debugging workflow node');

    // 2. Map nodeType to activity function
    const activityMap = {
      notification: activities.handleNotification,
      log: activities.handleLog,
      aiAgent: async (resolvedConfig, nodeId, workflowId, context) => {
        const { default: skillAgent } = await import('../agent/SkillAgent.js');
        const { default: skillService } = await import('../services/skill.service.js');
        const { extractTags } = await import('../utils/ai-parser.js');

        const prompt = resolvedConfig.systemPrompt || resolvedConfig.prompt || '';
        const userPrompt = resolvedConfig.userPrompt || '';
        const model = resolvedConfig.model || 'qwen';

        // 1. Resolve skills by ID if provided
        const skillIds = Array.isArray(resolvedConfig.skillIds)
          ? resolvedConfig.skillIds
          : (resolvedConfig.skillIds || '')
              .split(/[\|,]/)
              .map((s) => s.trim())
              .filter(Boolean);
        const resolvedSkills = await skillService.getAvailableSkills({
          ...context,
          requestedIds: skillIds,
        });

        // 2. Create a virtual SkillDef
        const virtualSkill = {
          id: `debug:${nodeId}`,
          name: 'DebugAINode',
          description: 'Debug view of AI node',
          type: 'PACKAGE_SKILL',
          sopContent: prompt,
          requires: {
            tools: resolvedSkills.map((s) => s.id),
            model: model,
          },
        };

        // 3. Execute via SkillAgent
        const messages = [{ role: 'user', content: userPrompt }];
        const result = await skillAgent.run({
          messages,
          skillDef: virtualSkill,
          sopContent: prompt,
          args: { query: userPrompt },
          context: {
            ...context,
            userId: context.userId,
            llmConfig: { provider: model },
          },
        });

        // 4. Transform result to activity-compatible shape
        const parsed = await extractTags(result.result);

        return {
          ...parsed,
          result: parsed.content || 'No response',
          rawContent: result.result,
          usage: result.usage || {},
        };
      },
      fetchResource: activities.handleFetchResources,
      createResource: activities.handleCreateDocument,
      dingTalkRobot: activities.handleDingTalkRobot,
      skillAction: activities.handleSkillAction,
      webhook: activities.handleWebhook,
      click: async (data) => ({ ...data, triggeredAt: new Date() }),
      capability: async (data) => ({ ...data, triggeredAt: new Date() }),
      'plugin-action': async (resolvedConfig, nodeId, workflowId, context) => {
        return activities.handlePluginAction(
          resolvedConfig.pluginId,
          resolvedConfig.pluginParams || resolvedConfig,
          { triggerData: context, workflowData: { _id: workflowId, appId: resolvedConfig.appId }, executionId: null, nodeId }
        );
      },
      skillAction: activities.handleSkillAction,
    };

    const activityFn = activityMap[nodeType];
    if (!activityFn) {
      return res
        .status(400)
        .json({ success: false, message: `No debug handler for node type: ${nodeType}` });
    }

    // 3. Execute activity directly
    // Note: Activity signatures are (data, nodeId, workflowId, context)
    // For debugging, we pass a mock nodeId and null workflowId
    const result = await activityFn(resolvedConfig, 'debug-node', null, context);

    sendSuccess(res, {
      result,
      resolvedConfig,
    });
  } catch (err) {
    logger.error({ err, nodeType }, 'Node debug failed');
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

const getAvailableSkills = asyncHandler(async (req, res) => {
  const orgId = req.headers['x-organization-id'];
  const appId = req.query.appId;
  const userId = req.user._id;

  const skills = await skillService.getAvailableSkills({ userId, orgId, appId });
  sendSuccess(res, skills);
});

const publishWorkflow = asyncHandler(async (req, res) => {
  const { skillConfig, name, isSkill } = req.body;
  // Force scope to ORGANIZATION
  // This calls skillService which now updates the workflow doc directly

  const workflow = await skillService.publishWorkflowAsSkill(
    req.params.id,
    { ...skillConfig, name, isSkill, scope: 'ORGANIZATION' },
    { userId: req.user._id, orgId: req.headers['x-organization-id'] },
  );
  sendSuccess(res, workflow);
});

const toggleStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const workflow = await workflowService.toggleStatus(
    req.headers['x-organization-id'],
    req.params.id,
    status,
  );

  if (status === 'INACTIVE') {
    await workflowScheduler.unschedule(workflow._id);
  } else if (status === 'ACTIVE' && workflow.triggerType === 'SCHEDULE') {
    await workflowScheduler.sync(workflow._id);
  }

  // Sync plugins for status toggle
  const pluginsInToggle = Array.from(
    new Set(
      workflow.nodes
        .filter((n) => ['plugin-trigger', 'plugin-action'].includes(n.type))
        .map((n) => n.data?.pluginId)
        .filter(Boolean),
    ),
  );

  for (const pid of pluginsInToggle) {
    try {
      await pluginService.reloadPlugin(pid);
    } catch (e) {
      logger.error(`Failed to reload plugin ${pid} on status toggle: ${e.message}`);
    }
  }

  sendSuccess(res, workflow);
});

const detachWorkflow = asyncHandler(async (req, res) => {
  const workflow = await skillService.detachSkill(req.params.id, {
    userId: req.user._id,
    orgId: req.headers['x-organization-id'],
  });
  sendSuccess(res, workflow);
});

const unlinkApp = asyncHandler(async (req, res) => {
  const workflow = await skillService.unlinkApp(req.params.id, {
    userId: req.user._id,
    orgId: req.headers['x-organization-id'],
  });
  sendSuccess(res, workflow);
});

const resetWorkflow = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const appId = req.body.appId || req.query.appId;
  const orgId = req.headers['x-organization-id'];

  const updated = await workflowService.resetWorkflow(orgId, id, {
    appId,
    userId: req.user._id,
  });

  sendSuccess(res, updated);
});

export default {
  createWorkflow,
  getWorkflows,
  getWorkflowById,
  updateWorkflow,
  deleteWorkflow,
  executeWorkflow,
  streamWorkflow,
  streamWorkflowEvents,
  handleWebhook,
  handleCancelWebhook,
  getAllExecutions,
  getWorkflowExecutions,
  getExecutionById,
  cancelExecution,
  debugNode,
  getAvailableSkills,
  publishWorkflow,
  toggleStatus,
  detachWorkflow,
  unlinkApp,
  resetWorkflow,
  getWorkflowInterface,
};
