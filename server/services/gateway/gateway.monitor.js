import workflowEvents from '../workflow.events.js';
import { ProtocolStreamer, GatewayWriter } from '../../utils/stream.protocol.js';
import { logger } from '../../config/logger.js';
import GatewaySessionRepository from '../../repositories/gatewaySession.repository.js';

/**
 * GatewayMonitor
 * 负责监控全局工作流事件并将其转发给相关的消息网关渠道。
 * 它实现了“自主工作流进度 -> 跨平台对话”的自动路由。
 */
class GatewayMonitor {
  constructor() {
    this.initialized = false;
    this.activeStreamers = new Map(); // executionId -> ProtocolStreamer
    this.myExecutions = new Set(); // 本实例认领/启动的 executionId 集合 (内存去重)
  }

  /**
   * 登记当前实例对某次工作流执行的“归属权”
   */
  registerMyExecution(executionId) {
    this.myExecutions.add(executionId);
    logger.debug({ executionId }, '[GatewayMonitor] Registered execution ownership locally');
  }

  /**
   * 初始化监听器
   */
  async init() {
    if (this.initialized) return;

    try {
      // 启动网关服务中心（初始化渠道连接、Provider 等）
      const { default: gatewayService } = await import('./gateway.service.js');
      await gatewayService.init();
    } catch (err) {
      logger.error({ err }, '[GatewayMonitor] GatewayService init failed');
    }

    // 监听所有核心工作流进度事件
    const events = [
      'workflow:start',
      'workflow:success',
      'workflow:error',
      'node:start',
      'node:success',
      'node:error',
      'node:progress',
    ];

    events.forEach((eventName) => {
      workflowEvents.on(eventName, (data) => this.handleEvent(eventName, data));
    });

    this.initialized = true;
    logger.info('[GatewayMonitor] System-wide workflow event monitoring initialized.');
  }

  /**
   * 处理具体的事件路由
   */
  async handleEvent(event, data) {
    try {
      // 1. 提取标识符 (工作流引擎通常会带上 sessionId 或 workflowId)
      const sessionId = data.sessionId || data.triggerData?.sessionId;
      const executionId = data.executionId;
      const parentExecutionId = data.parentExecutionId || data.triggerData?.parentExecutionId;

      // console.log('handleEvent....', sessionId, executionId, parentExecutionId);
      if (!sessionId || !executionId) {
        return;
      }

      // 1.1 跨实例事件过滤：如果该执行不是由当前实例启动的，直接忽略，避免多实例双发
      if (!this.myExecutions.has(executionId)) {
        return;
      }

      // 2. 检查该会话是否属于网关管辖 (即：是否有外部渠道绑定)
      const session = await GatewaySessionRepository.findBySessionId(sessionId);
      if (!session || session.platform === 'web') {
        // 如果是 Web 端的会话，通常由 UnifiedChatService 直接处理 SSE，Monitor 不介入以防双发
        return;
      }

      // 3. 获取或构建持久化 Streamer (单次执行轮次共享一个状态机)
      let streamer = this.activeStreamers.get(executionId);

      // 如果当前是子工作流，直接跳过 (子流程不直接参与网关卡片交互)
      if (parentExecutionId) {
        return;
      }

      // 核心修复：如果正在创建中，handleEvent 会因为并发而多次进入下方的 if，
      if (!streamer) {
        // 尝试获取一个“初始化锁” (防止惊群效应)
        if (!this._initLocks) this._initLocks = new Map();
        if (this._initLocks.has(executionId)) {
          streamer = await this._initLocks.get(executionId);
        } else {
          const initPromise = (async () => {
            try {
              const { default: gatewayService } = await import('./gateway.service.js');
              const sender = await gatewayService.createStreamSender(sessionId, executionId);
              const writer = new GatewayWriter(sessionId, executionId, sender);
              const newStreamer = new ProtocolStreamer(writer);
              this.activeStreamers.set(executionId, newStreamer);
              return newStreamer;
            } finally {
              this._initLocks.delete(executionId);
            }
          })();

          this._initLocks.set(executionId, initPromise);
          streamer = await initPromise;
        }
      }

      // 4. 执行协议分发
      streamer.absorbWorkflowEvent({
        ...data,
        status: data.status || event,
      });

      // 5. [统一清理逻辑]：工作流结束时，先完成 Streamer 状态机收尾，再释放内存
      const isTerminal = ['workflow:success', 'workflow:error', 'workflow:completed'].includes(
        event,
      );
      if (isTerminal) {
        streamer.finish(event === 'workflow:success' ? 'stop' : 'error');
        // 留 1s 缓冲确保最后的消息包能异步发完
        setTimeout(() => {
          this.activeStreamers.delete(executionId);
          this.myExecutions.delete(executionId); // 释放认领权
          logger.debug({ executionId }, '[GatewayMonitor] Execution resource reclaimed');
        }, 1000);
      }
    } catch (err) {
      logger.error({ err, event }, '[GatewayMonitor] Event routing failed');
    }
  }
}

export default new GatewayMonitor();
