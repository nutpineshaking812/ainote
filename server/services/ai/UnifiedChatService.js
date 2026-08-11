import { getTemporalClient } from '../../temporal/client.js';
import workflowEvents from '../workflow.events.js';
import { AIBaseService } from './base/AIBaseService.js';
import { logger } from '../../config/logger.js';
import env from '../../config/env.js';
import registryService from '../workflow/registry.service.js';
import { validateWorkflowInput } from '../workflow/validator.service.js';
import WorkflowRepository from '../../repositories/workflow.repository.js';
import workflowService from '../workflow.service.js';
import { WorkflowExecutionRepository } from '../../repositories/workflowExecution.repository.js';
import { TRIGGER_TYPES, mergeTriggerDefaults } from '../../utils/workflowUtils.js';
import { EMPLOYEE_SCENARIOS } from '../../constants/digitalEmployee.js';

/**
 * UnifiedChatService
 * Bridging Temporal Workflows with Real-time SSE Streams.
 * Inherits from AIBaseService to reuse protocol and stream management logic.
 */
export class UnifiedChatService extends AIBaseService {
  constructor({ user, appId, orgId, clientPlatform }) {
    // Disable base persistence because Temporal workflow handles its own recording
    super({
      userId: user.id || user._id,
      appId,
      scenario: EMPLOYEE_SCENARIOS.GENERAL,
      enablePersistence: false,
    });
    this.user = user;
    this.orgId = orgId;
    this.clientPlatform = clientPlatform;
  }

  /**
   * Unified Entry Point for streaming.
   * Matches signature required by agentStreamController.
   */
  async streamChat(writer, params) {
    // Override scenario to match the request
    if (params.scenario) this.scenario = params.scenario;
    return this.streamResponse(writer, params);
  }

  /**
   * Implementation of AIBaseService's abstract generator.
   * Bridges Temporal's event-emitter based progress to the generator stream.
   */
  async *executeAgent(params) {
    const {
      conversationId,
      message,
      scenario = EMPLOYEE_SCENARIOS.GENERAL,
      toolDefinitions,
    } = params;

    const resolvedScenario = scenario;
    const isBlockNote = resolvedScenario === EMPLOYEE_SCENARIOS.DOCUMENT && toolDefinitions;
    const client = await getTemporalClient();

    // 1. Resolve workflow definition first
    let configKey = params.workflowId || 'DEFAULT_AI_CHAT';
    if (!params.workflowId) {
      if (isBlockNote) configKey = 'DEFAULT_BLOCKNOTE';
      else if (resolvedScenario === EMPLOYEE_SCENARIOS.VIEW_DESIGN)
        configKey = 'DEFAULT_DATA_ANALYSIS';
    }

    let workflowDef = await registryService.getWorkflowByKey(configKey, this.appId);
    if (!workflowDef) {
      workflowDef = await WorkflowRepository.findById(configKey);
    }
    if (!workflowDef) throw new Error(`Workflow "${configKey}" not found`);
    const dbWorkflowId = (workflowDef.id || workflowDef._id)?.toString();

    // 2. Pre-flight validation (Before creating execution and Temporal!)
    const { data: rawData, ...restParams } = params;
    const cleanRestParams = Object.fromEntries(
      Object.entries(restParams).filter(([_, v]) => v !== undefined),
    );
    const mergedData = { ...(rawData || {}), ...cleanRestParams };
    console.log('TRACE_AINOTE UnifiedChatService.executeAgent mergedData before defaults:', {
      ...mergedData,
    });
    mergeTriggerDefaults(workflowDef.nodes, mergedData);
    console.log('TRACE_AINOTE UnifiedChatService.executeAgent mergedData after defaults:', {
      ...mergedData,
    });

    const validation = validateWorkflowInput(workflowDef, mergedData);
    if (!validation.valid) {
      logger.warn({ validation, configKey }, '[UnifiedChatService] Pre-flight validation failed');
      throw new Error(validation.error);
    }

    const cleanMergedData = { ...mergedData };
    delete cleanMergedData.writer;

    // 3. Create database execution record to pre-generate executionId (UUID)
    const triggerData = {
      sessionId: conversationId,
      sessionName: `[${this.user.nickname || this.user.username || 'User'}]的记忆`,
      ...cleanMergedData,
      triggeredBy: this.userId,
      orgId: this.orgId,
      conversationId: conversationId,
      message,
      clientPlatform: this.clientPlatform,
    };
    console.log(
      'TRACE_AINOTE UnifiedChatService.executeAgent triggerData to createExecution:',
      triggerData,
    );

    // Extract document synergy context for execution history tracking
    const resourceId =
      mergedData.documentId ||
      mergedData.resourceId ||
      params.data?.documentId ||
      params.data?.resourceId;
    const resourceType = resourceId ? 'DOCUMENT' : undefined;

    const execution = await workflowService.createExecution({
      workflowId: workflowDef.id || workflowDef._id,
      appId: this.appId,
      organizationId: this.orgId,
      triggeredBy: this.userId,
      resourceId,
      resourceType,
      triggerData,
    });

    const executionId = (execution.id || execution._id).toString();
    const temporalWorkflowId = `workflow-exec-${executionId}`;

    // Event queue to convert EventEmitter to AsyncGenerator
    const eventQueue = [];
    let resolveNext;
    let finished = false;
    let handle = null;

    const pushEvent = (event) => {
      eventQueue.push(event);
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
    };

    let clientAborted = false;
    const res = params.writer?.res;
    const onClientClose = () => {
      console.log(
        '[UnifiedChatService] client request closed (aborted), resolving pending generator promises to trigger cleanup',
      );
      clientAborted = true;
      finished = true;
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
    };
    res?.on('close', onClientClose);

    // 4. Unified Event Matching Helper (Matches real execution UUID or temporal ID)
    const isMatched = (data) => {
      const match = data.executionId === executionId || data.parentExecutionId === executionId;
      // ||
      // data.workflowId === temporalWorkflowId ||
      // data.executionId === temporalWorkflowId ||
      // data.parentExecutionId === temporalWorkflowId
      // console.log('TRACE_AINOTE UnifiedChatService.isMatched:', {
      //   dataExecutionId: data.executionId,
      //   dataParentExecutionId: data.parentExecutionId,
      //   dataWorkflowId: data.workflowId,
      //   expectedExecutionId: executionId,
      //   match,
      // });
      return match;
    };

    const progressHandler = (data) => {
      // console.log('progressHandler', data, 'executionId:', executionId);
      const matched = isMatched(data);
      // console.log('TRACE_AINOTE UnifiedChatService.progressHandler received event:', { data, matched });

      if (matched) {
        // [PROTOCOL CLEANSE] 为 BlockNote 编辑器提供“纯净”协议流
        // 核心目标：移除所有 BlockNote SDK (Zod) 不认识的元数据字段（如 workflowId, status, nodeId）
        if (isBlockNote) {
          const {
            status,
            workflowId,
            executionId: exId,
            nodeId,
            content,
            input,
            toolName,
            toolCallId,
            inputTextDelta,
            ...rest
          } = data;

          if (status === 'text-delta') {
            pushEvent({ type: 'text-delta', content });
            return;
          }

          if (status === 'tool-input-start') {
            pushEvent({ type: 'tool-input-start', toolCallId, toolName });
            return;
          }

          if (status === 'tool-input-delta') {
            pushEvent({ type: 'tool-input-delta', toolCallId, inputTextDelta });
            return;
          }

          if (status === 'tool-input-available') {
            pushEvent({
              type: 'tool-input-available', // 或者映射为 'tool-call'，取决于前端具体的 Zod 定义
              toolCallId,
              toolName,
              input,
            });
            return;
          }

          if (status === 'finish-step') {
            pushEvent({ type: 'finish-step' });
            return;
          }

          // 屏蔽所有其他 BlockNote 不认识的非标进度事件
          return;
        }

        // 正常聊天窗口：保留所有元数据 (nodeId, workflowId)，用于 ThoughtChain 渲染
        const event = { ...data, type: 'node:progress' };
        pushEvent(event);
      }
    };

    const sessionHandler = (data) => {
      const matched = isMatched(data);
      console.log('TRACE_AINOTE UnifiedChatService.sessionHandler received event:', {
        matched,
        dataExecutionId: data.executionId,
        dataParentExecutionId: data.parentExecutionId,
        expectedExecutionId: executionId,
        assistantMessageId: data.assistantMessageId,
        conversationId: data.conversationId,
      });
      if (matched && !isBlockNote) {
        // Broadcast session info (conversationId, messageId for UI to track)
        // AIBaseService.streamResponse will handle the emitting
        console.log('sessionHandler==>', data);
        pushEvent({
          type: 'data-conversation',
          data: {
            conversationId: data.conversationId,
            messageId: data.assistantMessageId,
            title: data.title,
          },
        });
      }
    };

    const errorHandler = (data) => {
      const matched = isMatched(data);
      console.log('TRACE_AINOTE UnifiedChatService.errorHandler received event:', {
        data,
        matched,
      });
      if (matched) {
        // --- 错误脱敏逻辑 (Error Sanitization) ---
        let userMessage = data.error || '工作流执行失败';
        const rawError = String(data.error || '');

        // 拦截 SQL/数据库错误
        if (
          rawError.includes('query') ||
          rawError.includes('select') ||
          rawError.includes('vector')
        ) {
          userMessage = '知识库检索服务异常，请检查向量数据库连接或模型配置。';
        } else if (rawError.includes('ECONNREFUSED') || rawError.includes('Connection')) {
          userMessage = '系统连接超时，请稍后重试。';
        } else if (rawError.includes('Validation Failed')) {
          // 预检校验错误通常比较友好，可以原样保留或微调
          userMessage = rawError.replace('Validation Failed:', '配置校验失败:');
        }

        // 服务端记录真实错误，前端只看脱敏后的消息
        logger.error(
          {
            originalError: data.error,
            sanitizedMessage: userMessage,
            workflowId: data.workflowId,
          },
          '[UnifiedChatService] Workflow Execution Error',
        );

        pushEvent({
          type: 'error',
          error: userMessage,
        });
      }
    };

    workflowEvents.on('node:progress', progressHandler);
    workflowEvents.on('session:ready', sessionHandler);
    workflowEvents.on('workflow:error', errorHandler);

    try {
      // 5. Start the Workflow in Temporal using the pre-created executionId
      handle = client.workflow.start('runWorkflow', {
        args: [workflowDef._id.toString(), execution.triggerData, executionId],
        taskQueue: env.TEMPORAL_TASK_QUEUE,
        workflowId: temporalWorkflowId,
      });

      // Update with Temporal info
      await WorkflowExecutionRepository.update(executionId, {
        temporalWorkflowId: temporalWorkflowId,
        temporalRunId: (await handle).runId,
      });

      logger.info(
        { executionId, temporalWorkflowId, configKey },
        '[UnifiedChatService] Workflow execution bridge started with real execution ID',
      );

      // Handle the workflow result as the end of the generator
      const workflowResultPromise = (async () => {
        try {
          await (await handle).result();
        } catch (err) {
          logger.error({ err }, '[UnifiedChatService] Workflow execution failed');
          pushEvent({ type: 'error', error: err.message });
        } finally {
          finished = true;
          if (resolveNext) resolveNext();
        }
      })();

      // 3. Yield events as they arrive
      while (!finished || eventQueue.length > 0) {
        if (eventQueue.length === 0) {
          await new Promise((resolve) => {
            resolveNext = resolve;
          });
        }
        while (eventQueue.length > 0) {
          yield eventQueue.shift();
        }
      }

      console.log(
        '[UnifiedChatService] Generator loop finished. finished:',
        finished,
        'clientAborted:',
        clientAborted,
      );
      if (!clientAborted) {
        await workflowResultPromise;
      }
    } catch (err) {
      logger.error({ err }, '[UnifiedChatService] Bridge failed');
      yield { type: 'error', error: err.message };
    } finally {
      console.log(
        '[UnifiedChatService] Generator finally cleanup block triggered. clientAborted:',
        clientAborted,
        'finished:',
        finished,
        'hasHandle:',
        !!handle,
      );
      // 核心安全逻辑：如果生成器被中断（如请求断开）且工作流未完成，则强制终止后台任务
      if ((clientAborted || !finished) && handle) {
        const h = await handle;
        logger.info(
          { executionId, temporalWorkflowId },
          '[UnifiedChatService] Stream interrupted, terminating background workflow',
        );
        try {
          console.log(
            '[UnifiedChatService] Invoking Temporal terminate() on workflow:',
            temporalWorkflowId,
          );
          await h.terminate('Client disconnected');
          console.log('[UnifiedChatService] Temporal workflow terminated successfully');
        } catch (e) {
          console.warn(
            '[UnifiedChatService] Failed to terminate workflow (might be already finished):',
            e.message,
          );
        }
      }
      if (res && onClientClose) {
        res.off('close', onClientClose);
      }
      workflowEvents.removeListener('node:progress', progressHandler);
      workflowEvents.removeListener('session:ready', sessionHandler);
      workflowEvents.removeListener('workflow:error', errorHandler);
    }
  }
}
