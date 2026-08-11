import pool from '../config/postgres.js';
import { logger } from '../config/logger.js';
import { randomUUID } from 'crypto';

/**
 * 跨进程消息总线
 * 当前实现：PostgreSQL LISTEN/NOTIFY（所有频道共享一个 LISTEN 连接）
 * 未来可替换为 Redis pub/sub、RabbitMQ 等，只需保持 publish/subscribe 接口不变
 *
 * 特性：
 * - 单一 LISTEN 连接复用所有频道
 * - 自动 JSON 序列化/反序列化
 * - 共享 instanceId，供消费者做自消息过滤
 * - 连接断开自动重连
 */
class EventBus {
  constructor() {
    this._client = null;
    this._initPromise = null; // 防止并发 _initListener 调用
    this._channels = new Map(); // channel -> Set<handler>
    this.instanceId = randomUUID();
    this._reconnectTimer = null;
  }

  /**
   * 发布消息到指定频道
   */
  async publish(channel, payload) {
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
    await pool.query(`SELECT pg_notify($1, $2)`, [channel, text]);
  }

  /**
   * 订阅频道消息
   * 同一频道可注册多个 handler；所有频道共享一个 LISTEN 连接
   */
  async subscribe(channel, handler) {
    // 确保 LISTEN 连接只初始化一次（防止并发调用产生竞态）
    if (!this._initPromise) {
      this._initPromise = this._initListener();
    }
    await this._initPromise;

    // 如果初始化失败，等待重连完成
    if (!this._client) {
      logger.warn({ channel }, '[EventBus] Client not ready, waiting for reconnect...');
      // 等待重连
      await this._waitForReconnect();
    }

    if (!this._channels.has(channel)) {
      this._channels.set(channel, new Set());
      await this._client.query(`LISTEN ${channel}`);
      logger.info({ channel }, '[EventBus] Listening on channel');
    }

    this._channels.get(channel).add(handler);
  }

  /**
   * 等待重连完成
   */
  async _waitForReconnect() {
    let attempts = 0;
    while (!this._client && attempts < 60) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
      if (!this._client && attempts % 5 === 0) {
        logger.info({ attempts }, '[EventBus] Still waiting for client...');
      }
    }
    if (!this._client) {
      throw new Error('[EventBus] Client unavailable after 60s of waiting');
    }
  }

  /**
   * 初始化 LISTEN 连接（内部方法）
   */
  async _initListener() {
    try {
      const client = await pool.connect();

      client.on('notification', (msg) => {
        const handlers = this._channels.get(msg.channel);
        if (!handlers) return;

        let payload;
        try {
          payload = JSON.parse(msg.payload);
        } catch {
          payload = msg.payload;
        }

        for (const h of handlers) {
          try {
            const result = h(payload, msg);
            if (result && typeof result.catch === 'function') {
              result.catch((err) =>
                logger.error(
                  { err: err.message, channel: msg.channel },
                  '[EventBus] Async handler error',
                ),
              );
            }
          } catch (err) {
            logger.error(
              { err: err.message, channel: msg.channel },
              '[EventBus] Handler error',
            );
          }
        }
      });

      client.on('error', (err) => {
        logger.error({ err }, '[EventBus] Listener connection error');
        try {
          client.release();
        } catch {
          /* ignore */
        }
        if (this._client === client) {
          this._client = null;
          this._initPromise = null; // 重置，允许下次 subscribe 重新初始化
          this._scheduleReconnect();
        }
      });

      this._client = client;
      logger.info('[EventBus] LISTEN connection established');
    } catch (err) {
      logger.error({ err }, '[EventBus] Failed to init listener');
      this._initPromise = null; // 重置，允许下次 subscribe 重新初始化
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    this._reconnectTimer = setTimeout(async () => {
      this._reconnectTimer = null;
      logger.info('[EventBus] Reconnecting...');
      await this._reconnectAll();
    }, 5000);
  }

  async _reconnectAll() {
    this._initPromise = this._initListener();
    await this._initPromise;

    if (!this._client) {
      logger.error('[EventBus] Reconnect failed, will retry');
      this._scheduleReconnect();
      return;
    }

    // 重新订阅所有频道
    for (const channel of this._channels.keys()) {
      try {
        await this._client.query(`LISTEN ${channel}`);
        logger.info({ channel }, '[EventBus] Re-subscribed on channel');
      } catch (err) {
        logger.error({ err, channel }, '[EventBus] Re-subscribe failed');
      }
    }
  }
}

export default new EventBus();
