import axios from 'axios';
import crypto from 'crypto';
import { DWClient, EventAck, TOPIC_ROBOT, TOPIC_CARD } from 'dingtalk-stream';
import { BaseProvider } from './base.js';
import { logger } from '../../../config/logger.js';

/**
 * 每一轮 AI 执行的独占发送器 (Stateful)
 * 职责：管理单次对话的流式卡片状态、内容缓冲区 and Promise 排队锁
 */
class DingTalkStreamSender {
  constructor(provider, platformMetadata, channelConfig, executionId) {
    this.provider = provider;
    this.meta = platformMetadata;
    this.config = channelConfig;
    this.executionId = executionId;

    // 状态管理
    this.thinking = '';
    this.text = '';
    this.outTrackId = null;
    this.terminated = false;
    this.isFlushing = false;
    this.flushTimer = null;
    this.updateLock = Promise.resolve(); // 核心：异步排队锁，确保卡片更新顺序
  }

  /**
   * 被 ProtocolStreamer / GatewayWriter 调用的核心方法
   */
  async write(type, body) {
    if (this.terminated) return;
    const content = body.content || '';

    // 1. 卡片初始化 (如果尚未创建)
    if (!this.outTrackId && !['finish', 'error'].includes(type)) {
      await this._ensureCardInitialized();
    }

    // 2. 累加内容与流控
    if (type === 'thinking-delta') {
      this.thinking += content;
      this._scheduleFlush();
    } else if (type === 'text-delta') {
      this.text += content;
      this._scheduleFlush();
    }
    // 3. 处理中间状态提示 (提供 UI 反馈)
    // else if (['node:start', 'tool-input-start', 'error'].includes(type)) {
    //   let statusText = '';
    //   if (type === 'tool-input-start') {
    //     statusText = '\n\n> 🔧 *正在调用搜索工具查找最新情报...*';
    //   } else if (type === 'node:start') {
    //     const nodeName = content || 'AI 分析环节';
    //     statusText = `\n\n> 🚀 *进入环节: ${nodeName}*`;
    //   } else if (type === 'error') {
    //     statusText = `\n\n> ❌ *发生错误:* \`${content}\``;
    //   }

    //   if (statusText) {
    //     this.updateLock = this.updateLock.then(() => this._updateCard(false, statusText));
    //   }
    // }
    // 4. 收尾
    else if (type === 'finish') {
      await this.finalize();
    }
  }

  async _ensureCardInitialized() {
    this.updateLock = this.updateLock.then(async () => {
      if (this.outTrackId) return;

      try {
        const { clientId, clientSecret, templateId } = this.config;
        const token = await this.provider._getAccessToken(clientId, clientSecret);

        // 构建唯一的 outTrackId (隔离不同 execution)
        const shortId =
          this.executionId.length > 12 ? this.executionId.substring(0, 12) : this.executionId;
        const outTrackId = `card_${shortId}_${crypto.randomUUID().substring(0, 8)}`;

        const cardResult = await this.provider._createCard(
          clientId,
          token,
          this.meta,
          outTrackId,
          templateId,
        );

        if (cardResult) {
          this.outTrackId = outTrackId;
          logger.info(
            { outTrackId, executionId: this.executionId },
            '[Gateway/DingTalk] Stream Card Initialized',
          );
        }
      } catch (err) {
        logger.error({ err: err.message }, '[Gateway/DingTalk] Stream Card Init Failed');
      }
    });
    return this.updateLock;
  }

  _scheduleFlush() {
    if (this.flushTimer || this.isFlushing || this.terminated) return;

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.terminated) return;

      this.isFlushing = true;
      this.updateLock = this.updateLock.then(async () => {
        try {
          await this._updateCard(false);
        } finally {
          this.isFlushing = false;
        }
      });
    }, 400);
  }

  async _updateCard(isFinal, delta) {
    if (!this.outTrackId) return;

    try {
      const token = await this.provider._getAccessToken(
        this.config.clientId,
        this.config.clientSecret,
      );

      let display = '';
      if (isFinal) {
        display =
          (this.thinking
            ? `> **思考过程**\n> ${this.thinking.split('\n').join('\n> ')}\n\n---\n\n`
            : '') + this.text;
      } else if (delta) {
        // 强制状态提示 (如：正在调用工具)
        display = delta;
      } else {
        // 常规流式更新：如果有思考内容，也要展示出来
        const thinkingPrefix = this.thinking
          ? `> 思考中...\n> ${this.thinking.replace(/\n/g, '\n> ')}\n\n`
          : '';
        display = thinkingPrefix + this.text;
      }

      const payload = {
        outTrackId: this.outTrackId,
        guid: crypto.randomUUID(),
        key: 'content',
        content: display,
        isFull: isFinal || delta === undefined, // 只要是定时刷新或最终态，就用全量更新 covers text accumulation
        isFinalize: isFinal || false,
      };

      await axios.put('https://api.dingtalk.com/v1.0/card/streaming', payload, {
        headers: { 'x-acs-dingtalk-access-token': token },
      });
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      logger.error(
        { err: errMsg, outTrackId: this.outTrackId, executionId: this.executionId },
        '[Gateway/DingTalk] Stream Card Push Failed',
      );
    }
  }

  async finalize() {
    this.terminated = true;
    if (this.flushTimer) clearTimeout(this.flushTimer);

    await (this.updateLock = this.updateLock.finally(async () => {
      try {
        await this._updateCard(true); // 最终收尾
      } catch (err) {
        logger.error({ err: err.message }, '[Gateway/DingTalk] Finalize failed');
      }
    }));
  }
}

/**
 * DingTalk Channel Provider (V2 Reinforced)
 * 钉钉渠道适配器：集成长连接、互动卡片流式渲染与节流策略。
 */
export class DingTalkProvider extends BaseProvider {
  constructor() {
    super();
    this.clients = new Map(); // channelId -> DWClient
    this.tokenCache = new Map(); // clientId -> { token, expiresAt }
  }

  /**
   * 工厂方法：创建一个支撑流式/有状态发送的执行器环境
   */
  createStreamSender(platformMetadata, channelConfig, executionId) {
    return new DingTalkStreamSender(this, platformMetadata, channelConfig, executionId);
  }

  /**
   * 启动渠道连接
   */
  async start(channel) {
    const { id, config } = channel;
    if (this.clients.has(id)) return;

    logger.info(
      { channelId: id, clientId: config.clientId },
      '[Gateway/DingTalk] Starting stream client',
    );

    const client = new DWClient({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });

    client.config.subscriptions = [
      { type: 'CALLBACK', topic: TOPIC_ROBOT },
      { type: 'CALLBACK', topic: TOPIC_CARD },
    ];

    // 1. 注册入站消息监听
    client.registerCallbackListener(TOPIC_ROBOT, async (res) => {
      try {
        const { default: gatewayService } = await import('../gateway.service.js');
        const data = JSON.parse(res.data);
        await gatewayService.handleInbound('dingtalk', id, {
          ...data,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
        });

        client.socketCallBackResponse(res.headers.messageId, EventAck.SUCCESS);
      } catch (err) {
        logger.error({ err: err.message }, '[Gateway/DingTalk] Inbound process failed');
        client.socketCallBackResponse(res.headers.messageId, EventAck.FAILURE);
      }
    });

    // 2. 自动确认卡片点击回调 (以支持 Stream 模式切换)
    client.registerCallbackListener(TOPIC_CARD, (e) =>
      client.socketCallBackResponse(e.headers.messageId, EventAck.SUCCESS),
    );

    await client.connect();
    this.clients.set(id, client);
  }

  /**
   * 停止渠道连接
   */
  async stop(channelId) {
    const client = this.clients.get(channelId);
    if (client) {
      try {
        await client.disconnect();
      } catch (e) {}
      this.clients.delete(channelId);
    }
  }

  /**
   * 内部 Helper：创建互动卡片底座
   */
  async _createCard(clientId, token, message, outTrackId, templateId) {
    if (!templateId) return null;

    const payload = {
      cardTemplateId: templateId,
      outTrackId: outTrackId,
      cardData: { cardParamMap: { content: '正在思考...' } },
      callbackType: 'STREAM',
      userIdType: 1,
      imGroupOpenSpaceModel: { supportForward: true },
      imRobotOpenSpaceModel: { supportForward: true },
    };

    if (message.conversationType === '2') {
      payload.openSpaceId = `dtv1.card//IM_GROUP.${message.conversationId}`;
      payload.imGroupOpenDeliverModel = { robotCode: clientId };
    } else {
      payload.openSpaceId = `dtv1.card//IM_ROBOT.${message.senderStaffId || message.senderId}`;
      payload.imRobotOpenDeliverModel = { spaceType: 'IM_ROBOT' };
    }

    const res = await axios.post(
      'https://api.dingtalk.com/v1.0/card/instances/createAndDeliver',
      payload,
      {
        headers: { 'x-acs-dingtalk-access-token': token },
      },
    );
    return res.data.success ? res.data : null;
  }

  /**
   * 内部 Helper：维护 Token 缓存
   */
  async _getAccessToken(clientId, clientSecret) {
    const now = Date.now();
    const cached = this.tokenCache.get(clientId);
    if (cached && cached.expiresAt > now + 300000) return cached.token;

    const res = await axios.post('https://api.dingtalk.com/v1.0/oauth2/accessToken', {
      appKey: clientId,
      appSecret: clientSecret,
    });
    const token = res.data.accessToken;
    this.tokenCache.set(clientId, { token, expiresAt: now + res.data.expireIn * 1000 });
    return token;
  }

  /**
   * 解析入站消息内容
   */
  parseContent(payload) {
    const msgType = payload.msgtype;
    if (msgType === 'text') return (payload.text?.content || '').trim();
    if (payload.msgtype === 'audio') return (payload.content?.recognition || '').trim();
    return '';
  }

  /**
   * 获取平台特定的触发上下文
   */
  getTriggerContext(payload) {
    return {
      dingtalkContext: {
        outTrackId: payload.outTrackId,
        templateId: payload.templateId,
        message: payload,
      },
    };
  }
}

export default new DingTalkProvider();
