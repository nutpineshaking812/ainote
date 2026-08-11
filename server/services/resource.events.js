import { EventEmitter } from 'events';
import { logger } from '../config/logger.js';
import eventBus from './eventBus.js';
import { RESOURCE_EVENTS } from '../constants/events.js';

/**
 * ResourceEvents 中枢
 * 基于 eventBus (PostgreSQL LISTEN/NOTIFY) 实现跨进程的资源变更感知
 */
class ResourceEvents extends EventEmitter {
  constructor() {
    super();
    this.channel = 'resource_events';
    this.instanceId = eventBus.instanceId;

    this._subscribe().catch((err) => {
      logger.error({ err }, '[ResourceEvents] Initial subscribe failed, will retry');
      setTimeout(() => this._subscribe().catch(() => {}), 5000);
    });
  }

  async _subscribe() {
    await eventBus.subscribe(this.channel, (msg) => {
      const { event, data, senderId } = msg;
      if (senderId === this.instanceId) return;

      // 广播给本地监听者，标记为非本地触发
      super.emit(event, { ...data, isLocallyEmitted: false });
    });

    logger.info(`[ResourceEvents] Global active (Channel: ${this.channel})`);
  }

  /**
   * 封装：发送资源更新事件
   */
  emitUpdated({ resourceId, type, appId }) {
    this._broadcast(RESOURCE_EVENTS.UPDATED, { resourceId, type, appId });
  }

  /**
   * 封装：发送资源创建事件
   */
  emitCreated({ resourceId, type, appId }) {
    this._broadcast(RESOURCE_EVENTS.CREATED, { resourceId, type, appId });
  }

  /**
   * 封装：发送资源删除事件
   */
  emitDeleted({ resourceId, type, appId }) {
    this._broadcast(RESOURCE_EVENTS.DELETED, { resourceId, type, appId });
  }

  /**
   * 核心广播逻辑 (私有)
   */
  _broadcast(event, data) {
    // 1. 本地触发 (标记为本地事件)
    super.emit(event, { ...data, isLocallyEmitted: true });

    // 2. 跨实例通知
    const payload = {
      event,
      data,
      senderId: this.instanceId,
      at: Date.now(),
    };

    const byteSize = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    if (byteSize > 7500) {
      logger.warn('[ResourceEvents] Payload too large, skipping');
      return;
    }

    eventBus.publish(this.channel, payload).catch((err) => {
      logger.error({ err, event }, '[ResourceEvents] Broadcast notify failed');
    });
  }
}

export default new ResourceEvents();
