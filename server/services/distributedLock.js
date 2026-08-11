import pool from '../config/postgres.js';
import { logger } from '../config/logger.js';

/**
 * 分布式锁
 * 当前实现：PostgreSQL 唯一约束 (INSERT 失败 = 已锁定)
 * 未来可替换为 Redis SET NX、Redlock、etcd 等，只需保持 tryAcquire/release 接口不变
 *
 * 特性：
 * - 基于 key 的互斥访问
 * - TTL 自动过期（防死锁）
 * - 容错：数据库异常时默认放行（fail-open）
 */
class DistributedLock {
  constructor() {
    this._initialized = false;
  }

  /**
   * 确保锁表存在（惰性初始化）
   */
  async _ensureTable() {
    if (this._initialized) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS distributed_locks (
        key VARCHAR(500) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL
      )
    `);
    this._initialized = true;
  }

  /**
   * 尝试获取锁
   * @param {string} key - 锁的唯一标识
   * @param {number} ttlMs - 锁的存活时间（毫秒），过期后自动释放
   * @returns {Promise<boolean>} true 表示成功获取，false 表示已被占用
   */
  async tryAcquire(key, ttlMs = 24 * 60 * 60 * 1000) {
    await this._ensureTable();

    try {
      // 顺带清理过期锁，防止表过度膨胀
      await pool.query(`DELETE FROM distributed_locks WHERE expires_at < NOW()`);

      await pool.query(
        `INSERT INTO distributed_locks (key, expires_at) VALUES ($1, NOW() + ($2 || ' milliseconds')::INTERVAL)`,
        [key, String(ttlMs)],
      );
      logger.debug({ key }, '[DistributedLock] Acquired');
      return true;
    } catch (err) {
      // 23505 = unique_violation — key 已存在
      if (err.code === '23505') {
        logger.debug({ key }, '[DistributedLock] Already locked');
        return false;
      }
      // 容错：数据库异常时默认放行保证可用性
      logger.error({ err, key }, '[DistributedLock] Acquire failed, failing open');
      return true;
    }
  }

  /**
   * 主动释放锁
   * @param {string} key - 锁的唯一标识
   */
  async release(key) {
    try {
      await pool.query(`DELETE FROM distributed_locks WHERE key = $1`, [key]);
    } catch (err) {
      logger.error({ err, key }, '[DistributedLock] Release failed');
    }
  }

  /**
   * 检查锁是否存在
   * @param {string} key - 锁的唯一标识
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    try {
      const result = await pool.query(
        `SELECT 1 FROM distributed_locks WHERE key = $1 AND expires_at > NOW()`,
        [key],
      );
      return result.rows.length > 0;
    } catch (err) {
      logger.error({ err, key }, '[DistributedLock] Exists check failed');
      return false;
    }
  }
}

export default new DistributedLock();
