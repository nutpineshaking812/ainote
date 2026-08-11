import env from '../../../config/env.js';

/**
 * 沙盒实例缓存：sessionId → { sandbox, createdAt }
 */
const sandboxCache = new Map();

/**
 * 正在创建中的 Promise 去重：sessionId → Promise<object|null>
 */
const inFlight = new Map();

/**
 * SDK 模块缓存（懒加载，导入一次后缓存）
 */
let _sdkModule = null;
async function _loadSDK() {
  if (!_sdkModule) {
    const t0 = Date.now();
    _sdkModule = await import('@alibaba-group/opensandbox');
    console.log(`[SandboxManager] SDK 导入完成 import=${Date.now() - t0}ms`);
  }
  return _sdkModule;
}

/**
 * SandboxManager — 管理远程 OpenSandbox 沙盒的生命周期
 *
 * - 按 sessionId 复用沙盒，避免每次请求都创建新容器
 * - 自动续期，防止长时间 Agent 执行中超时
 * - 支持手动销毁单个或清空全部
 */
export class SandboxManager {
  /**
   * 获取或创建沙盒实例。
   * @param {string} sessionId - 会话标识，用于复用沙盒
   * @returns {Promise<object|null>} OpenSandbox 实例，或 null（沙盒功能关闭时）
   */
  async getOrCreate(sessionId) {
    const t0 = Date.now();
    // 已有实例，直接返回 + 续期
    const cached = sandboxCache.get(sessionId);
    if (cached) {
      console.log(`[SandboxManager] 命中缓存 session=${sessionId}`);
      try {
        await cached.sandbox.setTimeout(env.SANDBOX_TIMEOUT);
      } catch {
        // 续期失败不阻塞
      }
      return cached.sandbox;
    }

    // 正在创建中，复用同一个 promise 避免并发重复创建
    const pending = inFlight.get(sessionId);
    if (pending) {
      console.log(`[SandboxManager] 复用进行中的创建 session=${sessionId}`);
      return pending;
    }

    const createPromise = this._doCreate(sessionId);
    inFlight.set(sessionId, createPromise);

    try {
      const sandbox = await createPromise;
      return sandbox;
    } finally {
      inFlight.delete(sessionId);
      console.log(`[SandboxManager] getOrCreate 总耗时: ${Date.now() - t0}ms`);
    }
  }

  async _doCreate(sessionId) {
    try {
      const { Sandbox, ConnectionConfig } = await _loadSDK();

      // 自签名证书：跳过 TLS 验证（生产环境建议换 Let's Encrypt 证书）
      if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      }

      const connectionConfig = new ConnectionConfig({
        domain: env.SANDBOX_SERVER_URL,
        protocol: env.SANDBOX_SERVER_URL.startsWith('https') ? 'https' : 'http',
        apiKey: env.SANDBOX_API_KEY,
        useServerProxy: env.SANDBOX_USE_SERVER_PROXY,
      });

      const tCreate = Date.now();
      const sandbox = await Sandbox.create({
        connectionConfig,
        image: env.SANDBOX_IMAGE,
        timeoutSeconds: env.SANDBOX_TIMEOUT,
      });
      console.log(`[SandboxManager] Sandbox.create 完成 create=${Date.now() - tCreate}ms`);

      sandboxCache.set(sessionId, { sandbox, createdAt: Date.now() });

      console.log(`[SandboxManager] 沙盒已创建 session=${sessionId}`);
      return sandbox;
    } catch (err) {
      console.warn(`[SandboxManager] 创建沙盒失败 session=${sessionId}: ${err.message}`);
      return null;
    }
  }

  /**
   * 获取指定会话的沙盒实例（不创建，不续期）。
   * @param {string} sessionId
   * @returns {object|null}
   */
  getSandbox(sessionId) {
    const entry = sandboxCache.get(sessionId);
    return entry ? entry.sandbox : null;
  }

  /**
   * 销毁指定会话的沙盒。
   * @param {string} sessionId
   */
  async destroy(sessionId) {
    const entry = sandboxCache.get(sessionId);
    if (!entry) return;

    sandboxCache.delete(sessionId);
    try {
      await entry.sandbox.kill();
      console.log(`[SandboxManager] 沙盒已销毁 session=${sessionId}`);
    } catch (err) {
      console.warn(`[SandboxManager] 销毁沙盒失败 session=${sessionId}: ${err.message}`);
    }
  }

  /**
   * 销毁所有缓存的沙盒（用于进程退出/全局清理）。
   */
  async destroyAll() {
    if (sandboxCache.size === 0) return;

    const entries = [...sandboxCache.entries()];
    sandboxCache.clear();

    const results = await Promise.allSettled(
      entries.map(([sessionId, entry]) =>
        entry.sandbox.kill().catch((err) => {
          console.warn(`[SandboxManager] 销毁沙盒失败 session=${sessionId}: ${err.message}`);
        })
      )
    );

    console.log(`[SandboxManager] 已清理 ${results.length} 个沙盒`);
  }
}
