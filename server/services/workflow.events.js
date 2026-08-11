import { EventEmitter } from 'events';
import { logger } from '../config/logger.js';
import eventBus from './eventBus.js';

/**
 * WorkflowEvents hub
 * 基于 eventBus (PostgreSQL LISTEN/NOTIFY) 实现跨进程事件广播，
 * 同时保留 EventEmitter 供本进程 SSE 实时推送。
 */
class WorkflowEvents extends EventEmitter {
  constructor() {
    super();
    this.channel = 'workflow_events';
    this.instanceId = eventBus.instanceId;

    // Detect if current process is a Temporal Worker
    const isWorker =
      process.env.IS_TEMPORAL_WORKER === 'true' ||
      (process.argv[1] && (process.argv[1].includes('worker.js') || process.argv[1].includes('worker.cjs')));

    if (isWorker) {
      logger.info('[WorkflowEvents] Temporal Worker process detected, skipping LISTEN subscription.');
    } else {
      this._subscribe().catch((err) => {
        logger.error({ err }, '[WorkflowEvents] Initial subscribe failed, will retry');
        setTimeout(() => this._subscribe().catch(() => {}), 5000);
      });
    }
  }

  /**
   * 订阅跨进程事件
   */
  async _subscribe() {
    await eventBus.subscribe(this.channel, async (msg) => {
      const { event, data, senderId } = msg;

      // Skip messages from self to avoid double emission
      if (senderId === this.instanceId) return;

      // If it's a stripped payload, fetch the full data from DB
      if (data && data._warning && data.executionId && data.nodeId && event === 'node:success') {
        try {
          const { WorkflowExecutionRepository } = await import('../repositories/workflowExecution.repository.js');
          const execution = await WorkflowExecutionRepository.findById(data.executionId);
          if (execution && execution.nodeResults && execution.nodeResults[data.nodeId]) {
            const nodeRecord = execution.nodeResults[data.nodeId];
            data.result = nodeRecord.result;
            data.resolvedConfig = nodeRecord.resolvedConfig;
            delete data._warning;
            delete data.status;
            logger.info({ executionId: data.executionId, nodeId: data.nodeId }, '[WorkflowEvents] Successfully reconstituted stripped payload from DB');
          } else {
            logger.warn({ executionId: data.executionId, nodeId: data.nodeId }, '[WorkflowEvents] Stripped payload could not be found in DB');
          }
        } catch (fetchErr) {
          logger.error({ fetchErr, executionId: data.executionId }, '[WorkflowEvents] Failed to fetch full payload from DB');
        }
      }

      // Emit locally for SSE handlers on this instance
      super.emit(event, data);
    });
  }

  /**
   * Overridden emit to broadcast events globally via eventBus.
   */
  emit(event, data) {
    // 1. Trigger local listeners immediately for responsiveness
    super.emit(event, data);

    // 2. Broadcast to other instances asynchronously
    this._publish(event, data).catch((err) => {
      logger.error({ err, event }, '[WorkflowEvents] Broadcast failed');
    });
  }

  /**
   * 发布事件到 eventBus（含 payload 裁剪逻辑）
   */
  async _publish(event, data) {
    const EXTREME_LIMIT = 7500;

    const sanitize = (obj, currentDepth = 0) => {
      if (currentDepth > 2 || !obj || typeof obj !== 'object') return obj;

      const result = Array.isArray(obj) ? [] : {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && value.length > 2000) {
          result[key] = value.substring(0, 2000) + '... (truncated for event center)';
        } else if (typeof value === 'object' && value !== null) {
          result[key] = sanitize(value, currentDepth + 1);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    const sanitizedData = sanitize(data);

    const payload = {
      event,
      data: sanitizedData,
      senderId: this.instanceId,
      at: Date.now(),
    };

    const byteSize = Buffer.byteLength(JSON.stringify(payload), 'utf8');

    if (byteSize > EXTREME_LIMIT) {
      const fallbackPayload = {
        event,
        data: {
          workflowId: data?.workflowId,
          executionId: data?.executionId,
          nodeId: data?.nodeId,
          sessionId: data?.sessionId,
          parentExecutionId: data?.parentExecutionId,
          _warning: 'Payload stripped: exceeds PostgreSQL NOTIFY limits',
        },
        senderId: this.instanceId,
        at: Date.now(),
      };

      logger.warn(
        { event, size: byteSize, nodeId: data?.nodeId },
        '[WorkflowEvents] Payload exceeds 8KB limit, broadcasting minimal fallback content',
      );

      await eventBus.publish(this.channel, fallbackPayload);
      return;
    }

    await eventBus.publish(this.channel, payload);
  }
}

export default new WorkflowEvents();

