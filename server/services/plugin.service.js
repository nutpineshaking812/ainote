import fs from 'fs';
import path from 'path';
import { logger } from '../config/logger.js';
import env from '../config/env.js';
import workflowEvents from './workflow.events.js';

/**
 * 插件服务核心 (Plugin Service Core)
 */

class PluginService {
  constructor() {
    this.plugins = new Map(); // Key: pluginId, Value: { instance, ctx }
    this.manifests = new Map(); // Key: pluginId, Value: manifest object
    this.watchers = new Map(); // Key: pluginId, Value: fs.FSWatcher
    this.statuses = new Map(); // Key: pluginId, Value: { status, timestamp }
    this.reloadingPromises = new Map(); // Key: pluginId, Value: Promise (reload task)
    this.initPromise = null; // 用于避免重复初始化
  }

  /**
   * 初始化：扫描并启动所有插件
   */
  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (!fs.existsSync(env.PLUGINS_DIR)) return;

      const items = fs.readdirSync(env.PLUGINS_DIR);
      logger.info(`[PluginService] Initializing ${items.length} plugins...`);

      for (const pluginId of items) {
        const pPath = path.join(env.PLUGINS_DIR, pluginId);
        if (fs.statSync(pPath).isDirectory()) {
          await this.loadPlugin(pluginId, false);
          this.setupWatcher(pluginId);
        }
      }

      logger.info('[PluginService] Starting plugin hot-reload watcher...');
    })();

    return this.initPromise;
  }

  /**
   * 安全地加载/重载单个插件
   */
  async loadPlugin(pluginId, isReload = false) {
    try {
      const pPath = path.join(env.PLUGINS_DIR, pluginId, 'handler.js');
      const mPath = path.join(env.PLUGINS_DIR, pluginId, 'manifest.json');
      if (!fs.existsSync(pPath)) return;

      // 读取并缓存元数据
      if (fs.existsSync(mPath)) {
        try {
          this.manifests.set(pluginId, JSON.parse(fs.readFileSync(mPath, 'utf8')));
        } catch (e) {
          logger.warn(`Failed to parse manifest for ${pluginId}: ${e.message}`);
        }
      }

      // ─── 重载逻辑 ───
      if (isReload && this.plugins.has(pluginId)) {
        const oldEntry = this.plugins.get(pluginId);
        if (oldEntry.instance.onDeactivate) {
          try {
            await oldEntry.instance.onDeactivate(oldEntry.ctx);
          } catch (e) {
            logger.warn(`Deactivate failed for ${pluginId}: ${e.message}`);
          }
        }
      }

      // ESM 导入缓存绕过
      const instance = await import(`${pPath}?t=${Date.now()}`);

      // ─── 构造受控上下文 ───
      const eventBus = (await import('./workflow.events.js')).default;
      const WorkflowRepository = (await import('../repositories/workflow.repository.js')).default;
      const { WorkflowExecutionRepository } =
        await import('../repositories/workflowExecution.repository.js');
      const { getTemporalClient } = await import('../temporal/client.js');
      const userPropertyService = (await import('./userProperty.service.js')).default;

      const ctx = {
        pluginId,
        logger,

        // 1. 安全的行为接口
        getActiveWorkflows: async () => {
          return await WorkflowRepository.findActiveByPlugin(pluginId);
        },

        // 2. 受限的工作流触发能力
        triggerWorkflow: async (workflowId, triggerData, options = {}) => {
          const workflow = await WorkflowRepository.findById(workflowId);
          if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

          const wfIdStr = (workflow.id || workflow._id).toString();

          const execution = await WorkflowExecutionRepository.create({
            workflowId: wfIdStr,
            triggerData,
            organizationId: workflow.organizationId,
            appId: workflow.appId,
            status: 'RUNNING',
          });

          const executionId = (execution.id || execution._id).toString();
          const client = await getTemporalClient();

          await client.workflow.start('runWorkflow', {
            args: [wfIdStr, triggerData, executionId],
            taskQueue: env.TEMPORAL_TASK_QUEUE,
            workflowId: options.deterministicId || `exec-${executionId}`,
          });

          return { executionId, workflowId: wfIdStr };
        },

        // 3. 撤销/终止工作流
        terminateWorkflow: async (deterministicId) => {
          if (!deterministicId) return;
          const client = await getTemporalClient();
          try {
            const handle = client.workflow.getHandle(deterministicId);
            // await handle.terminate('Terminated by plugin: restart needed');
            await handle.cancel();
          } catch (err) {
            // 忽略未找到或已结束的情况
          }
        },

        // 4. 安全的消息总线代理
        eventBus: {
          on: (event, handler) => eventBus.on(event, handler),
          off: (event, handler) => eventBus.off(event, handler),
        },

        // 4. 环境参数掩码
        config: {
          isDev: env.NODE_ENV !== 'production',
          apiUrl: env.REACT_APP_API_URL,
        },

        // 5. 持久化存储能力 (非执行状态下默认归属于 SYSTEM)
        // userProperties: {
        //   get: async (key, defaultValue = null, userId = 'SYSTEM') =>
        //     userPropertyService.getProperty(userId, key, defaultValue),
        //   set: async (key, value, strategy = 'overwrite', userId = 'SYSTEM') =>
        //     userPropertyService.setProperty(userId, key, value, strategy),
        // },

        // 6. 状态反馈 (用于 UI 实时显示)
        updateStatus: (arg1, arg2) => {
          const key = arg2 ? arg1 : pluginId;
          const status = arg2 || arg1;
          this.updatePluginStatus(pluginId, key, status);
        },
      };

      // 🛡️ 核心修复：将 instance 和 ctx 封装存储，避免修改 read-only 模块对象
      const pluginEntry = { instance, ctx };

      if (instance.onActivate) {
        await instance.onActivate(ctx);
      }

      this.plugins.set(pluginId, pluginEntry);
      logger.info(`[PluginService] Plugin success: ${pluginId} (isReload: ${isReload})`);
    } catch (err) {
      logger.error({ err, pluginId }, '[PluginService] Plugin failure');
      this.statuses.set(pluginId, {
        status: 'FAILED',
        error: err.message,
        stack: err.stack,
        timestamp: new Date()
      });
    }
  }

  /**
   * 外部触发插件重载 (带防抖/排队机制)
   * @param {string} pluginId
   */
  async reloadPlugin(pluginId) {
    // 🛡️ 竞态保护：如果该插件正在重载中，直接返回现有的 Promise
    if (this.reloadingPromises.has(pluginId)) {
      return this.reloadingPromises.get(pluginId);
    }

    const reloadTask = (async () => {
      try {
        await this.loadPlugin(pluginId, true);
      } finally {
        this.reloadingPromises.delete(pluginId);
      }
    })();

    this.reloadingPromises.set(pluginId, reloadTask);
    return reloadTask;
  }

  /**
   * 获取所有已加载插件的元数据 (供前端 UI 使用)
   * @returns {Array} List of plugin manifests
   */
  getPluginsMetadata() {
    return Array.from(this.manifests.values());
  }

  /**
   * 文件监听
   */
  setupWatcher(pluginId) {
    if (this.watchers.has(pluginId)) return;

    const watcher = fs.watch(env.PLUGINS_DIR, { recursive: true }, (event, filename) => {
      // 检查文件名是否属于该插件目录
      if (
        filename &&
        filename.startsWith(pluginId) &&
        (filename.endsWith('.js') || filename.endsWith('.json'))
      ) {
        logger.info(
          `[PluginService] Hot reloading plugin: ${pluginId} due to change in ${filename}...`,
        );
        this.loadPlugin(pluginId, true);
      }
    });

    this.watchers.set(pluginId, watcher);
  }

  /**
   * 更新插件状态 (支持插件级或实例级)
   * @param {string} pluginId 所属插件
   * @param {string} key 具体的标识 (如 nodeId 或 clientId)，默认是 pluginId
   * @param {Object} status 状态对象
   */
  updatePluginStatus(pluginId, key, status) {
    this.statuses.set(key, {
      ...status,
      pluginId,
      timestamp: new Date().toISOString(),
    });
    logger.info(`[PluginService] Status updated for key [${key}]:`, status);
  }

  /**
   * 获取指定的或所有的插件状态数据
   */
  getPluginsStatus(keys = null) {
    if (!keys || (Array.isArray(keys) && keys.length === 0)) {
      return Object.fromEntries(this.statuses);
    }
    const result = {};
    const keyArray = Array.isArray(keys) ? keys : [keys];
    keyArray.forEach((key) => {
      if (this.statuses.has(key)) {
        result[key] = this.statuses.get(key);
      }
    });
    return result;
  }

  resolvePluginKey(id) {
    if (this.plugins.has(id)) return id;
    for (const [key, manifest] of this.manifests.entries()) {
      if (manifest.id === id) return key;
    }
    return id;
  }

  /**
   * 获取插件处理器 (供 Activity 调用)
   */
  getHandler(pluginId) {
    const key = this.resolvePluginKey(pluginId);
    const entry = this.plugins.get(key);
    return entry ? entry.instance.handler : null;
  }

  /**
   * 构造插件执行时的上下文 (Execution Context)
   * 职责：将全局插件上下文与当前执行的 runtime 信息（如执行人、工作流实例）融合
   * @param {string} pluginId
   * @param {Object} runtimeCtx { triggerData, workflowData, executionId }
   */
  async getExecutionContext(pluginId, runtimeCtx = {}) {
    const key = this.resolvePluginKey(pluginId);
    const entry = this.plugins.get(key);
    if (!entry) return null;

    const { triggerData, workflowData, executionId, nodeId, edges, nodeResults } = runtimeCtx;
    const userPropertyService = (await import('./userProperty.service.js')).default;

    // 确定当前上下文的核心标识
    const executorId = triggerData?.triggeredBy;
    const orgId = triggerData?.orgId || workflowData?.organizationId;
    const appId = triggerData?.appId || workflowData?.appId;

    // 返回精简、显式的执行上下文，剔除不必要的原始对象
    return {
      // 基础方法
      pluginId: entry.ctx.pluginId,
      logger: entry.ctx.logger,
      getActiveWorkflows: entry.ctx.getActiveWorkflows,
      triggerWorkflow: entry.ctx.triggerWorkflow,
      eventBus: entry.ctx.eventBus,
      config: entry.ctx.config,
      updateStatus: entry.ctx.updateStatus,

      // 7. 发送自定义 SSE 进度事件 (符合 Vercel AI 协议)
      sendProgress: (status, payload = {}) => {
        workflowEvents.emit('node:progress', {
          workflowId: workflowData?._id?.toString(),
          executionId: executionId,
          nodeId,
          sessionId: triggerData?.sessionId || payload.sessionId,
          parentExecutionId: triggerData?.parentExecutionId || payload.parentExecutionId,
          orgId,
          appId,
          status,
          ...payload,
        });
      },

      // 8. 发送自定义控制台实时日志事件
      sendConsoleLog: (message) => {
        console.log('sendConsoleLog', message);
        workflowEvents.emit('node:progress', {
          workflowId: workflowData?._id?.toString(),
          executionId: executionId,
          nodeId,
          sessionId: triggerData?.sessionId,
          parentExecutionId: triggerData?.parentExecutionId,
          orgId,
          appId,
          status: 'log',
          message,
        });
      },

      // 显式运行参数
      executorId,
      orgId,
      appId,
      workflowId: workflowData?._id?.toString(),
      executionId: executionId,
      nodeId,
      triggerData: triggerData || {}, // 仅提供必要的输入数据
      edges: edges || [],
      nodeResults: nodeResults || {},

      // 增强能力
      userProperties: {
        get: async (key, defaultValue = null, ttl = -1, optionalUserId = null) => {
          const targetId = optionalUserId || executorId;
          if (!targetId) {
            logger.warn(
              `[PluginContext] userProperties.get called without userId for plugin: ${pluginId}`,
            );
            return defaultValue;
          }
          return await userPropertyService.getProperty(targetId, key, defaultValue, ttl);
        },
        set: async (key, value, strategy = 'overwrite', ttl = -1, optionalUserId = null) => {
          const targetId = optionalUserId || executorId;
          if (!targetId) {
            throw new Error(`[PluginContext] userProperties.set requires a target userId`);
          }
          return await userPropertyService.setProperty(targetId, key, value, strategy, ttl);
        },
      },
    };
  }
}

export default new PluginService();
