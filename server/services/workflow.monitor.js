import WorkflowRepository from '../repositories/workflow.repository.js';
import workflowEvents from './workflow.events.js';
import { logger } from '../config/logger.js';

class WorkflowMonitor {
  init() {
    logger.info('Initializing Workflow Monitor [VERSION 3 - FIX CAST]...');
    console.log('******************************************');
    console.log('>>> WORKFLOW MONITOR [V3] LOADED OK <<<');
    console.log('******************************************');
    this.setupListeners();
  }

  setupListeners() {
    workflowEvents.on('workflow:success', this.handleWorkflowSuccess.bind(this));
    // workflowEvents.on('workflow:error', this.handleWorkflowError.bind(this));
  }

  async handleWorkflowSuccess({ workflowId, executionId, triggeredAt }) {
    if (!workflowId) return;

    // Skip update for virtual system IDs as they don't exist in the database
    if (typeof workflowId === 'string' && workflowId.startsWith('system_')) {
      return;
    }

    try {
      await WorkflowRepository.update(workflowId, {
        lastRunAt: triggeredAt || new Date(),
      });
    } catch (err) {
      logger.error({ workflowId, err }, 'Failed to update workflow lastRunAt');
    }
  }
}

export default new WorkflowMonitor();
