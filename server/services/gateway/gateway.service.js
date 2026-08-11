import { logger } from '../../config/logger.js';
import sessionService from './session.service.js';
import GatewayChannelRepository from '../../repositories/gatewayChannel.repository.js';
import { getTemporalClient } from '../../temporal/client.js';
import env from '../../config/env.js';
import dingtalkProvider from './providers/dingtalk.provider.js';
import wetinkerProvider from './providers/wetinker.provider.js';
import gatewayMonitor from './gateway.monitor.js';
import gatewayBus from '../eventBus.js';
import distributedLock from '../distributedLock.js';

class GatewayService {
  constructor() {
    this.providers = new Map(); // providerId -> ProviderInstance
    this.registerProvider('dingtalk', dingtalkProvider);
    this.registerProvider('wetinker', wetinkerProvider);
    this.isInitialized = false;
  }

  /**
   * Register a platform driver (e.g. DingTalkProvider)
   */
  registerProvider(providerId, driver) {
    this.providers.set(providerId, driver);
    logger.info({ providerId }, 'Gateway provider registered');
  }

  /**
   * Initialize all active channels from database (Startup only)
   * 同时监听跨进程渠道控制命令（API 进程通过 pg_notify 发送 start/stop 指令）
   */
  async init() {
    if (this.isInitialized) return;

    const channels = (await GatewayChannelRepository.findAllEnabled?.()) || [];
    logger.info({ count: channels.length }, 'Initializing active channels in Gateway');

    // 并发启动所有渠道，避免单个渠道连接缓慢阻塞整体初始化
    channels.forEach((channel) => {
      this.startChannel(channel)
        .then(() => {
          logger.info({ channelId: channel.id }, 'Channel initialization task dispatched');
        })
        .catch((err) => {
          logger.error(
            { channelId: channel.id, err: err.message },
            'Failed to start channel during initialization',
          );
        });
    });

    // 通过消息总线监听跨进程渠道控制命令（API 进程 publish，Gateway 进程 subscribe）
    try {
      await gatewayBus.subscribe('gateway_command', async ({ action, channelId }) => {
        logger.info({ action, channelId }, '[Gateway] Received channel control command');
        if (action === 'start') {
          const channel = await GatewayChannelRepository.findById(channelId);
          if (channel) await this.startChannel(channel);
        } else if (action === 'stop') {
          await this.stopChannel(channelId);
        }
      });
      logger.info('[Gateway] Listening for channel control commands on gateway_command channel');
    } catch (err) {
      logger.error({ err: err.message }, '[Gateway] Failed to setup command listener');
    }

    this.isInitialized = true;
  }

  /**
   * Dynamically start a channel
   */
  async startChannel(channel) {
    if (channel.status !== 'ACTIVE') return;

    const provider = this.providers.get(channel.providerId);
    if (!provider) {
      logger.warn({ providerId: channel.providerId }, 'Provider driver not found for channel');
      return;
    }

    try {
      await provider.start(channel);
      logger.info(
        { channelId: channel.id, providerId: channel.providerId },
        'Channel started in Gateway',
      );
    } catch (err) {
      logger.error({ channelId: channel.id, err: err.message }, 'Failed to start channel');
    }
  }

  /**
   * Dynamically stop a channel
   */
  async stopChannel(channelId) {
    // We need to know which provider this channel belongs to.
    // Usually we find the channel first.
    const channel = await GatewayChannelRepository.findById(channelId);
    if (!channel) return;

    const provider = this.providers.get(channel.providerId);
    if (provider && provider.stop) {
      try {
        await provider.stop(channelId);
        logger.info({ channelId }, 'Channel stopped in Gateway');
      } catch (err) {
        logger.error({ channelId, err: err.message }, 'Failed to stop channel');
      }
    }
  }

  /**
   * External Trigger Entry Point
   * Standardizes the incoming message and kicks off the workflow.
   */
  async handleInbound(providerId, channelId, rawPayload) {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Provider ${providerId} not found`);

    // 0. 跨实例分布式消息去重
    const msgId = rawPayload.wxMessageId || rawPayload.msgId || `${rawPayload.senderId || ''}:${rawPayload.time || ''}:${rawPayload.messageContent || ''}`;
    const deduplicateKey = `inbound:${providerId}:${channelId}:${msgId}`;
    const acquired = await distributedLock.tryAcquire(deduplicateKey);
    if (!acquired) {
      logger.warn({ deduplicateKey }, '[GatewayService] Duplicate inbound message detected');
      return;
    }
    logger.info({ deduplicateKey }, '[GatewayService] Successfully acquired inbound message lock');

    // 1. Resolve Session
    const session = await sessionService.resolve(providerId, channelId, rawPayload);

    // 2. Normalize Content
    const query = provider.parseContent(rawPayload);

    const channel = await GatewayChannelRepository.findById(channelId);
    if (!channel) throw new Error('Channel not found');

    // 3. 解析需要响应的数字员工 ID。如果没选到（返回空），则视为被过滤不予处理。
    const targetEmployeeId = await provider.resolveEmployee(channel, rawPayload);
    if (!targetEmployeeId) {
      logger.info({ providerId, channelId }, 'Inbound message filtered out: no digital employee resolved');
      return;
    }

    const executionId = `gateway-${Date.now()}-${session.sessionId.substring(0, 8)}`;

    // 1.1 登记认领当前执行，确保之后各阶段的广播消息最终只有本实例才会执行发送/回包
    gatewayMonitor.registerMyExecution(executionId);

    const triggerData = {
      message: query,
      sessionId: session.sessionId,
      channelId: channelId,
      orgId: channel.organizationId,
      appId: channel.appId,
      platformMetadata: session.platformMetadata,
      triggerType: 'INBOUND',
      triggeredAt: new Date(),
    };

    // 动态注入提供商特定的上下文变量
    if (provider.getTriggerContext) {
      Object.assign(triggerData, provider.getTriggerContext(rawPayload));
    }

    // 启动数字员工逻辑
    if (!targetEmployeeId) {
      throw new Error(`Channel ${channelId} has no digital employee bound`);
    }

    logger.info(
      { sessionId: session.sessionId, employeeId: targetEmployeeId },
      'Gateway dispatching to Digital Employee',
    );

    // 动态导入：避免 Gateway 独立进程启动时拉入整个 AI/LangChain 依赖链
    const { default: digitalEmployeeService } = await import('../digitalEmployee.service.js');
    return digitalEmployeeService.executeEmployee(targetEmployeeId, triggerData, {
      executionId,
    });
  }

  /**
   * The "Universal Outbound" method
   * Any part of the system can call this to send a message back to the user.
   */
  async send(sessionId, message) {
    // 统一走有状态工厂：哪怕只是一次性消息，也封装在 Sender 中，确保流程一致且不依赖 BaseProvider.send
    const sender = await this.createStreamSender(sessionId, message.executionId || 'one_off');

    if (!sender) {
      logger.warn(
        { sessionId },
        'No sender available for session, attempted fallback to direct protocol',
      );
      return;
    }

    try {
      // 这里的逻辑是：既然是原子发送，直接写完并由 Sender 自行收尾
      await sender.write(message.type || 'text-delta', { content: message.content });
      await sender.finalize();
    } catch (err) {
      logger.error(
        { err: err.message, sessionId },
        '[GatewayService] Atomic send failed via stateful sender',
      );
    }
  }

  /**
   * 为具体的 AI 执行轮次创建一个有状态的流式发送器
   * 职责：分层获取会话、渠道配置和 Provider 工厂实例
   */
  async createStreamSender(sessionId, executionId) {
    try {
      const { default: GatewaySessionRepository } =
        await import('../../repositories/gatewaySession.repository.js');
      const sessionWithChannel = await GatewaySessionRepository.findWithChannel(sessionId);

      if (!sessionWithChannel) {
        logger.warn(
          { sessionId },
          '[GatewayService] Session/Channel not found for sender creation',
        );
        return null;
      }

      const { channel, ...session } = sessionWithChannel;
      if (session.platform === 'web') return null;

      const provider = this.getProvider(session.platform);
      if (provider && typeof provider.createStreamSender === 'function') {
        return provider.createStreamSender(session.platformMetadata, channel.config, executionId);
      }

      return null;
    } catch (err) {
      logger.error(
        { err: err.message, sessionId, executionId },
        '[GatewayService] Create stream sender failed',
      );
      return null;
    }
  }

  getProvider(platform) {
    return this.providers.get(platform);
  }

}

export default new GatewayService();
