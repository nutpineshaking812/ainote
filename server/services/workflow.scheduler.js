import WorkflowRepository from '../repositories/workflow.repository.js';
import { logger } from '../config/logger.js';
import { getTemporalClient } from '../temporal/client.js';
import env from '../config/env.js';

class WorkflowScheduler {
  /**
   * Initialize all active scheduled workflows on startup
   */
  async init() {
    const workflows = await WorkflowRepository.findByOrganization(null, {
      status: 'ACTIVE',
      triggerType: 'SCHEDULE',
    });
    logger.info({ count: workflows.length }, 'Syncing scheduled workflows with Temporal');

    for (const workflow of workflows) {
      await this.schedule(workflow);
    }
  }

  async schedule(workflow) {
    const wfId = (workflow.id || workflow._id).toString();
    const { triggerConfig } = workflow;
    const { scheduleMode, cron, intervalValue, intervalUnit, specificTime } = triggerConfig || {};
    const scheduleId = `schedule-${wfId}`;

    const spec = {
      timezone: 'Asia/Shanghai',
    };

    if (scheduleMode === 'interval') {
      let seconds = intervalValue || 60;
      if (intervalUnit === 'minutes') seconds *= 60;
      else if (intervalUnit === 'hours') seconds *= 3600;
      spec.intervals = [{ every: `${seconds}s` }];
    } else if (scheduleMode === 'once' && specificTime) {
      const date = new Date(specificTime);
      const months = [
        'JANUARY',
        'FEBRUARY',
        'MARCH',
        'APRIL',
        'MAY',
        'JUNE',
        'JULY',
        'AUGUST',
        'SEPTEMBER',
        'OCTOBER',
        'NOVEMBER',
        'DECEMBER',
      ];

      // For one-time execution, UTC is the safest way to ensure precision across servers
      spec.timezone = 'UTC';
      spec.calendars = [
        {
          second: [date.getUTCSeconds()],
          minute: [date.getUTCMinutes()],
          hour: [date.getUTCHours()],
          dayOfMonth: [date.getUTCDate()],
          month: [months[date.getUTCMonth()]],
          year: [date.getUTCFullYear()],
        },
      ];
    } else {
      const cronExpression = cron || '0 9 * * *';
      spec.cronExpressions = [cronExpression];
    }

    try {
      const client = await getTemporalClient();

      // Upsert Temporal Schedule
      await client.schedule
        .create({
          scheduleId,
          spec,
          action: {
            type: 'startWorkflow',
            workflowType: 'runWorkflow',
            args: [
              { id: wfId },
              {
                triggerType: 'SCHEDULE',
                triggeredBy: workflow.createdBy, // Use creator as system user
                organizationId: workflow.organizationId,
              },
            ],
            taskQueue: env.TEMPORAL_TASK_QUEUE,
          },
          state: {
            paused: workflow.status !== 'ACTIVE',
            remainingActions: scheduleMode === 'once' ? 1 : undefined,
          },
        })
        .catch(async (err) => {
          if (err.name === 'ScheduleAlreadyRunningError' || err.message.includes('already exists')) {
            // Update existing schedule
            const handle = client.schedule.getHandle(scheduleId);
            await handle.update((prev) => ({
              ...prev,
              spec,
              action: {
                ...prev.action,
                args: [
                  { id: wfId },
                  {
                    triggerType: 'SCHEDULE',
                    triggeredBy: workflow.createdBy,
                    organizationId: workflow.organizationId,
                  },
                ],
              },
              state: {
                paused: workflow.status !== 'ACTIVE',
                remainingActions: scheduleMode === 'once' ? 1 : undefined,
              },
            }));
          } else {
            throw err;
          }
        });
    } catch (err) {
      logger.error({ workflowId: wfId, err }, 'Failed to sync schedule with Temporal');
    }
  }

  async unschedule(workflowId) {
    const scheduleId = `schedule-${workflowId}`;
    try {
      const client = await getTemporalClient();
      const handle = client.schedule.getHandle(scheduleId);
      await handle.delete();
      logger.info({ workflowId }, 'Workflow schedule deleted from Temporal');
    } catch (err) {
      if (
        err.name === 'NotFoundError' ||
        err.message.includes('not found') ||
        err.name === 'ScheduleNotFoundError'
      ) {
        return;
      }
      logger.error({ workflowId, err }, 'Failed to delete schedule from Temporal');
    }
  }

  /**
   * Sync a specific binding with Temporal
   */
  async syncBinding(bindingId) {
    const { default: gatewayWorkflowBindingRepository } = await import(
      '../repositories/gatewayWorkflowBinding.repository.js'
    );
    const binding = await gatewayWorkflowBindingRepository.findById(bindingId);
    if (!binding || !binding.cron || binding.status !== 'ENABLED') {
      await this.unscheduleBinding(bindingId);
      return;
    }

    const workflow = await WorkflowRepository.findById(binding.workflowId);
    if (!workflow) return;

    await this.scheduleBinding(binding, workflow);
  }

  async scheduleBinding(binding, workflow) {
    const bindingId = binding.id.toString();
    const wfId = workflow.id.toString();
    const scheduleId = `binding-${bindingId}`;

    const spec = {
      timezone: 'Asia/Shanghai',
      cronExpressions: [binding.cron],
    };

    try {
      const client = await getTemporalClient();
      const actionArgs = [
        wfId,
        {
          triggerType: 'SCHEDULE',
          triggeredBy: workflow.createdBy,
          organizationId: workflow.organizationId,
          sessionId: binding.targetSessionId,
          bindingId: bindingId,
        },
        null,
      ];

      await client.schedule
        .create({
          scheduleId,
          spec,
          action: {
            type: 'startWorkflow',
            workflowType: 'runWorkflow',
            args: actionArgs,
            taskQueue: env.TEMPORAL_TASK_QUEUE,
          },
          state: {
            paused: binding.status !== 'ENABLED' || workflow.status !== 'ACTIVE',
          },
        })
        .catch(async (err) => {
          if (err.name === 'ScheduleAlreadyRunningError' || err.message.includes('already exists')) {
            const handle = client.schedule.getHandle(scheduleId);
            await handle.update((prev) => ({
              ...prev,
              spec,
              action: {
                ...prev.action,
                args: actionArgs,
              },
              state: {
                paused: binding.status !== 'ENABLED' || workflow.status !== 'ACTIVE',
              },
            }));
          } else {
            throw err;
          }
        });

      logger.info({ bindingId, scheduleId }, 'Session-specific schedule synced with Temporal');
    } catch (err) {
      logger.error({ bindingId, err }, 'Failed to sync binding schedule with Temporal');
    }
  }

  async unscheduleBinding(bindingId) {
    const scheduleId = `binding-${bindingId}`;
    try {
      const client = await getTemporalClient();
      const handle = client.schedule.getHandle(scheduleId);
      await handle.delete();
      logger.info({ bindingId }, 'Binding schedule deleted from Temporal');
    } catch (err) {
      // Ignore not found
    }
  }

  /**
   * Re-sync a specific workflow (called after update)
   */
  async sync(workflowId) {
    const workflow = await WorkflowRepository.findById(workflowId);
    if (!workflow || workflow.triggerType !== 'SCHEDULE') {
      await this.unschedule(workflowId);
    } else {
      await this.schedule(workflow);
    }
  }
}

export default new WorkflowScheduler();
