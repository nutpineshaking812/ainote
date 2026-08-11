import WorkflowRepository from '../repositories/workflow.repository.js';
import { WorkflowExecutionRepository } from '../repositories/workflowExecution.repository.js';
import workflowService from './workflow.service.js';
import { getTemporalClient } from '../temporal/client.js';
import env from '../config/env.js';
import { logger } from '../config/logger.js';
import workflowEvents from './workflow.events.js';
import { ApiError } from '../utils/ApiError.js';
import { validateWorkflowInput } from './workflow/validator.service.js';

class WorkflowTriggerService {
  /**
   * Trigger specific webhook workflow with validation
   */
  async triggerWebhook(workflowId, { method, headers, query, body }) {
    const workflow = await WorkflowRepository.findById(workflowId);
    if (!workflow) {
      throw ApiError.notFound('Workflow not found');
    }
    if (workflow.status !== 'ACTIVE') {
      throw ApiError.badRequest('Workflow is not active');
    }
    if (workflow.triggerType !== 'WEBHOOK') {
      throw ApiError.badRequest('Workflow is not a Webhook workflow');
    }

    const workflowNodes = workflow.nodes || [];
    const webhookNode = workflowNodes.find((n) => n.type === 'webhook');
    if (!webhookNode) {
      throw ApiError.badRequest('Webhook node configuration not found');
    }

    const config = webhookNode.data || {};

    // 1. Method Validation
    if (config.methods && Array.isArray(config.methods) && config.methods.length > 0) {
      if (!config.methods.includes(method)) {
        throw ApiError.badRequest(`Method ${method} not allowed`);
      }
    }

    // 2. Secret Validation
    if (config.secret) {
      const clientSecret = headers['x-webhook-secret'] || query.secret;
      if (clientSecret !== config.secret) {
        throw ApiError.unauthorized('Invalid webhook secret');
      }
    }

    // 3. Frequency Control (Rate Limiting)
    if (config.rateLimit && config.rateLimit > 0) {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const wfIdStr = (workflow.id || workflow._id).toString();
      const count = await WorkflowExecutionRepository.count({
        workflowId: wfIdStr,
        createdAtGte: oneMinuteAgo,
      });

      if (count >= config.rateLimit) {
        throw ApiError.badRequest('Rate limit exceeded');
      }
    }

    // 4. Extract optional delay (in seconds)
    const delayValue = (headers && headers['x-delay']) || (query && query.delay) || (body && body.delay) || 0;
    const startDelaySec = parseInt(delayValue);
    const options = {};
    if (!isNaN(startDelaySec) && startDelaySec > 0) {
      options.startDelay = `${startDelaySec}s`;
    }

    return await this.executeWorkflow(
      workflow,
      {
        triggerType: 'WEBHOOK',
        event: 'http',
        data: { method, headers, query, body },
        triggeredAt: new Date(),
        triggeredBy: workflow.createdBy?.toString(),
      },
      options,
    );
  }

  /**
   * Cancel execution for webhook workflow with secret validation
   */
  async cancelWebhook(workflowId, executionId, { headers, query }) {
    const workflow = await WorkflowRepository.findById(workflowId);
    if (!workflow) {
      throw ApiError.notFound('Workflow not found');
    }

    const webhookNode = (workflow.nodes || []).find((n) => n.type === 'webhook');
    const config = webhookNode?.data || {};

    if (config.secret) {
      const clientSecret = headers['x-webhook-secret'] || query.secret;
      if (clientSecret !== config.secret) {
        throw ApiError.unauthorized('Invalid webhook secret');
      }
    }

    return await workflowService.cancelExecution(workflow.organizationId, executionId, {
      skipAuth: true,
    });
  }

  /**
   * Trigger workflows by an event (e.g., 'dataChange', 'webhook')
   */
  async triggerEvent(type, { organizationId, formId, event, data, workflowId, triggeredBy }) {
    try {
      let workflows = [];
      
      if (workflowId) {
        const wf = await WorkflowRepository.findById(workflowId);
        if (wf && wf.status === 'ACTIVE' && wf.triggerType === type.toUpperCase()) {
          workflows = [wf];
        }
      } else {
        workflows = await WorkflowRepository.findActiveByTrigger(
          type.toUpperCase(),
          organizationId?.toString()
        );
      }

      for (const workflow of workflows) {
        // Additional filtering for dataChange
        if (type === 'dataChange' && formId) {
          const config = workflow.triggerConfig || {};
          if (config.formId && config.formId !== formId) continue;
          if (config.event && config.event !== event) continue;
        }

        await this.executeWorkflow(workflow, {
          triggerType: type.toUpperCase(),
          event,
          data,
          triggeredAt: new Date(),
          triggeredBy: triggeredBy?.toString() || workflow.createdBy?.toString(),
        });
      }
    } catch (err) {
      logger.error({ type, err }, 'Failed to trigger workflows');
    }
  }

  /**
   * Send a signal to waiting workflows
   */
  async signalDataUpdate(formId, recordId, data) {
    try {
      const client = await getTemporalClient();
      const { executions } = await WorkflowExecutionRepository.find({
        status: 'RUNNING',
      }, { limit: 50 });

      for (const exec of executions) {
        const wfId = (exec.id || exec._id).toString();
        // Conceptually, we'd signal workflows here.
        // Needs proper tracking of workflow IDs in Temporal.
      }
    } catch (err) {
      logger.error({ formId, recordId, err }, 'Failed to signal data update');
    }
  }

  async executeWorkflow(workflow, triggerData, options = {}) {
    const businessData = triggerData.data || {};
    const validation = validateWorkflowInput(workflow, businessData);
    if (!validation.valid) {
      logger.warn({ workflowId: workflow.id || workflow._id, validation }, '[WorkflowTriggerService] Pre-flight validation failed');
      throw ApiError.badRequest(validation.error);
    }

    const client = await getTemporalClient();

    const wfIdStr = (workflow.id || workflow._id).toString();
    const execution = await workflowService.createExecution({
      workflowId: wfIdStr,
      organizationId: workflow.organizationId?.toString(),
      triggeredBy: triggerData.triggeredBy?.toString(),
      triggerData: {
        ...triggerData,
        triggeredAt: triggerData.triggeredAt || new Date(),
      },
    });

    const executionId = (execution.id || execution._id).toString();
    const temporalWorkflowId = `workflow-${wfIdStr}-${executionId}`;
    
    try {
      const handle = await client.workflow.start('runWorkflow', {
        args: [{ id: wfIdStr }, triggerData, executionId],
        taskQueue: env.TEMPORAL_TASK_QUEUE,
        workflowId: temporalWorkflowId,
        startDelay: options.startDelay,
      });

      // Update with Temporal info
      await WorkflowExecutionRepository.update(executionId, {
        temporalWorkflowId: temporalWorkflowId,
        temporalRunId: handle.runId
      });

      workflowEvents.emit('workflow:start', { workflowId: wfIdStr, executionId });
      return execution;
    } catch (err) {
      logger.error({ workflowId: wfIdStr, err }, 'Failed to start workflow in Temporal');
      // Update execution status to FAILED in DB if start fails
      await WorkflowExecutionRepository.update(executionId, {
        status: 'FAILED',
        error: { message: err.message, stack: err.stack }
      });
      throw err;
    }
  }
}

export default new WorkflowTriggerService();
