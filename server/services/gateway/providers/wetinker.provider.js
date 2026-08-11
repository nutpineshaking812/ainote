import axios from 'axios';
import { BaseProvider } from './base.js';
import { logger } from '../../../config/logger.js';

// WeTinker API 接口定义（通过 env.WETINKER_API_BASE_URL 配置）
import env from '../../../config/env.js';

const WETINKER_SSE_SUBSCRIBE_URL = `${env.WETINKER_API_BASE_URL}/api/wetinker/module/sse/channel/sse/subscribe`;
const WETINKER_MSG_SEND_URL = `${env.WETINKER_API_BASE_URL}/api/wetinker/module/sass/external/msg/send`;

/**
 * WeTinker 消息类型枚举
 */
export const WtImMessageType = {
  UNKNOWN: 0, // 未知消息
  TEXT: 1, // 文本消息
  IMG: 2, // 图片消息
  VOICE: 3, // 音频文件消息
  VIDEO: 4, // 视频文件消息
  LINK: 5, // 链接消息
  FILE: 6, // 文件消息
  VIDEO_CARD: 7, // 视频号消息
  APP: 8, // 小程序消息
  DYNAMIC_EMOJI: 9, // 动态表情消息
  CONNECTION: 10, // 接龙消息
  CALL_TEL: 11, // 通话消息
  POSTCARD: 41, // 名片消息
  SYSTEM: 1000, // 系统消息
};

/**
 * WeTinker 消息发送器
 */
class WeTinkerStreamSender {
  constructor(provider, platformMetadata, channelConfig, executionId) {
    this.provider = provider;
    this.meta = platformMetadata;
    this.config = channelConfig;
    this.executionId = executionId;
    this.fullContent = ''; // 用于累计增量内容
  }

  /**
   * 接收来自工作流的流式内容
   */
  async write(type, body) {
    const content = body.content || '';

    // 累计正文内容
    if (type === 'text-delta') {
      this.fullContent += content;
    }

    if (type === 'finish') {
      await this.finalize();
    }
  }

  /**
   * 执行完成后的回调
   */
  async finalize() {
    // 将累计的完整内容发送给用户
    console.log('fullContent====>', this.fullContent);
    
    if(this.fullContent && this.fullContent.length > 0 && this.fullContent !== 'unknown') {
      await this.provider.sendReply(this.meta, this.fullContent, this.config);
    }
  }
}

/**
 * WeTinker 渠道提供商
 * 通过 SSE 连接接收消息，并触发内部工作流
 */
export class WeTinkerProvider extends BaseProvider {
  constructor() {
    super();
    this.connections = new Map(); // channelId -> { abortController, retryTimer, watchdogTimer, retryCount, active }
  }

  /**
   * 创建流式发送器
   */
  createStreamSender(platformMetadata, channelConfig, executionId) {
    return new WeTinkerStreamSender(this, platformMetadata, channelConfig, executionId);
  }

  /**
   * 启动渠道逻辑
   */
  async start(channel) {
    const { id } = channel;
    // 如果已经存在且处于激活状态，则不重复启动
    const existing = this.connections.get(id);
    if (existing && existing.active) return;

    this.connections.set(id, {
      active: true,
      retryCount: 0,
      abortController: null,
      retryTimer: null,
      watchdogTimer: null,
    });

    this._doConnect(channel);
  }

  /**
   * 执行实际的 SSE 连接逻辑
   */
  async _doConnect(channel) {
    const { id, config } = channel;
    const connState = this.connections.get(id);

    if (!connState || !connState.active) return;

    // 初始化看门狗
    this._resetWatchdog(channel);

    logger.info(
      { channelId: id, appId: config.appId, retry: connState.retryCount },
      '[Gateway/WeTinker] Attempting SSE connection',
    );

    const abortController = new AbortController();
    connState.abortController = abortController;

    try {
      const response = await axios.post(
        WETINKER_SSE_SUBSCRIBE_URL,
        {
          appId: config.appId,
          accountIds: config.accountIds ? config.accountIds.split(/[|,]/).map((s) => s.trim()) : [],
        },
        {
          responseType: 'stream',
          signal: abortController.signal,
          headers: {
            Accept: 'text/event-stream',
            'Content-Type': 'application/json',
          },
        },
      );

      // 连接成功，重置重试计数
      connState.retryCount = 0;
      logger.info(
        { channelId: id, appId: config.appId },
        '[Gateway/WeTinker] SSE connection established successfully',
      );

      response.data.on('data', async (chunk) => {
        // 收到任何字节都重置看门狗
        this._resetWatchdog(channel);

        // console.log('=====>chunk', chunk.toString());

        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('event:')) {
            const dataStr = line.substring(6).trim();
            if (dataStr) {
              try {
                const payload = JSON.parse(dataStr);
                const code = payload.code;
                if (code === 99) {
                  // 被新连接挤下线（常见于热更新/多实例场景）
                  // 语义：我是旧连接，有更新的合法连接已建立并把我踢下线了。
                  // 正确处理：彻底停止，不再重连。重连只会把新连接踢掉，造成无限互踢。
                  logger.warn(
                    { channelId: id },
                    '[Gateway/WeTinker] Kicked by a newer connection (code 99). Stopping permanently to avoid fight-back.',
                  );
                  retryScheduled = true; // 阻止 end/error 事件再次调度重试
                  // 彻底停止该渠道：清理资源、标记为非激活、从连接表中移除
                  await this.stop(id);

                } else if (code === 100) {
                  const data = JSON.parse(payload.content);
                  await this._handleIncomingMessage(id, data);
                }
              } catch (e) {
                // 忽略非 JSON 格式的 SSE 数据
                logger.warn({ channelId: id, err: e.message }, '[Gateway/WeTinker] Failed to parse SSE payload');
              }
            }
          }
        }
      });

      // 防止 'end' 和 'error' 同时触发时重复调度重试（竞态问题）
      let retryScheduled = false;
      const scheduleRetryOnce = (reason) => {
        if (retryScheduled) return;
        retryScheduled = true;
        logger.debug({ channelId: id, reason }, '[Gateway/WeTinker] Scheduling retry (once guard)');
        this._scheduleRetry(channel);
      };

      response.data.on('error', (err) => {
        logger.error({ err: err.message, channelId: id }, '[Gateway/WeTinker] SSE Stream Error');
        scheduleRetryOnce('stream_error');
      });

      response.data.on('end', () => {
        logger.info({ channelId: id }, '[Gateway/WeTinker] SSE Stream Ended');
        scheduleRetryOnce('stream_end');
      });
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        logger.error(
          { err: err.message, channelId: id },
          '[Gateway/WeTinker] Failed to establish SSE connection',
        );
        this._scheduleRetry(channel);
      }
    }
  }

  /**
   * 安排重试任务
   */
  _scheduleRetry(channel) {
    const { id } = channel;
    const connState = this.connections.get(id);

    // 如果不再激活或已经有定时器，则不处理
    if (!connState || !connState.active || connState.retryTimer) return;

    // 清理所有旧的状态和定时器
    this._clearConnectionResources(connState);

    // 指数退避：1s, 2s, 4s, 8s, 16s, 32s, 最高 60s
    const delay = Math.min(Math.pow(2, connState.retryCount) * 1000, 60000);
    connState.retryCount++;

    logger.info(
      { channelId: id, nextRetryIn: `${delay / 1000}s` },
      '[Gateway/WeTinker] Scheduling reconnection',
    );

    connState.retryTimer = setTimeout(() => {
      connState.retryTimer = null;
      // 防御性检查：定时器触发时再次确认连接仍有效，避免 stop() 后仍尝试重连
      if (!this.connections.has(id)) return;
      this._doConnect(channel);
    }, delay);
  }

  /**
   * 停止 SSE 连接并取消后续重试
   */
  async stop(channelId) {
    const connState = this.connections.get(channelId);
    if (connState) {
      connState.active = false; // 标记为非激活，阻止自动重连
      this._clearConnectionResources(connState);
      this.connections.delete(channelId);
      logger.info({ channelId }, '[Gateway/WeTinker] Channel stopped manually');
    }
  }

  /**
   * 重置看门狗定时器
   */
  _resetWatchdog(channel) {
    const { id } = channel;
    const connState = this.connections.get(id);
    if (!connState || !connState.active) return;

    if (connState.watchdogTimer) {
      clearTimeout(connState.watchdogTimer);
    }

    // 如果 90 秒内没有收到任何数据（包括心跳），则认为连接已挂死
    connState.watchdogTimer = setTimeout(() => {
      // 防御性检查：定时器触发时再次确认连接仍有效，避免 stop() 后仍触发重连
      if (!this.connections.has(id)) return;
      logger.warn(
        { channelId: id },
        '[Gateway/WeTinker] SSE connection silent for 90s, forcing reconnect',
      );
      this._scheduleRetry(channel);
    }, 90000);
  }

  /**
   * 统一清理连接相关的资源（控制器、定时器）
   */
  _clearConnectionResources(connState) {
    if (connState.retryTimer) {
      clearTimeout(connState.retryTimer);
      connState.retryTimer = null;
    }
    if (connState.watchdogTimer) {
      clearTimeout(connState.watchdogTimer);
      connState.watchdogTimer = null;
    }
    if (connState.abortController) {
      try {
        connState.abortController.abort();
      } catch (e) {}
      connState.abortController = null;
    }
  }

  /**
   * 处理接收到的原始消息
   */
  async _handleIncomingMessage(channelId, payload) {
    try {
      const { default: gatewayService } = await import('../gateway.service.js');

      // 适配层：将平台特定的消息格式化
      const normalizedPayload = this.adaptPayload(payload);
      if (normalizedPayload) {
        await gatewayService.handleInbound('wetinker', channelId, normalizedPayload);
      }
    } catch (err) {
      logger.error({ err: err.message }, '[Gateway/WeTinker] Inbound process failed');
    }
  }

  /**
   * 适配层：解析平台特定的 Payload (留空待实现)
   * userId、conversationId 必存在
   */
  adaptPayload(payload) {
    // {
    //   "accountId": 0,
    //   "channelId": 0,
    //   "contactId": 0,
    //   "contactType": 0,
    //   "entityId": 0,
    //   "externalUserId": "",
    //   "messageContent": "",
    //   "messageType": 0,
    //   "senderId": 0,
    //   "time": "",
    //   "wxMessageId": 0,
    //   "wxUserId": ""
    // }
    const message = {
      ...payload,
      userId: payload.externalUserId,
      conversationId: `${payload.accountId}-${payload.contactId}`,
    };
    if (payload.messageType === WtImMessageType.TEXT) {
      message.content = payload.messageContent;
      return message;
    }
    return;
  }

  /**
   * 解析入站消息内容
   */
  parseContent(payload) {
    return payload.content || '';
  }

  /**
   * 获取平台特定的触发上下文
   */
  // getTriggerContext(payload) {
  //   return {
  //     wetinkerContext: {
  //       accountId: payload.accountId,
  //       channelId: payload.channelId,
  //       contactId: payload.contactId,
  //       contactType: payload.contactType,
  //       senderId: payload.senderId,
  //       externalUserId: payload.externalUserId,
  //       wxUserId: payload.wxUserId,
  //       wxMessageId: payload.wxMessageId,
  //       messageType: payload.messageType,
  //     },
  //   };
  // }

  /**
   * 发送回复消息
   */
  async sendReply(meta, content, config) {
    logger.info(
      { content, appId: config.appId, contactId: meta.contactId },
      '[Gateway/WeTinker] Sending reply',
    );

    try {
      const payload = {
        accountId: meta.accountId,
        channelId: config.channelId,
        msgContentList: [
          {
            msgContent: content,
            msgType: WtImMessageType.TEXT,
          },
        ],
        receiveObjId: meta.contactId,
      };
      // console.log('payload===>', payload);

      const res = await axios.post(WETINKER_MSG_SEND_URL, payload);
      logger.debug({ response: res.data }, 'WeTinker message sent');
    } catch (err) {
      logger.error(
        { err: err.response?.data || err.message, meta },
        '[Gateway/WeTinker] Failed to send reply',
      );
    }
  }

  /**
   * 解析 WeTinker 渠道入站消息所匹配的目标数字员工 ID
   */
  async resolveEmployee(channel, rawPayload) {
    const tagRoutes = channel.config?.tagRoutes || [];
    
    // 如果没有配置标签路由表，默认回退到全局绑定的数字员工
    if (tagRoutes.length === 0) {
      if (channel.employeeId) {
        return channel.employeeId;
      }
      logger.warn({ channelId: channel.id }, '[Gateway/WeTinker] No fallback employee or routes configured');
      return null;
    }

    try {
      const { accountId, channelId, contactId } = rawPayload;
      logger.info(
        { accountId, channelId, contactId },
        '[Gateway/WeTinker] Fetching contact tag info for dynamic routing',
      );

      const tagResponse = await axios.get(
        `${WETINKER_API_BASE_URL}/api/wetinker/module/sass/external/contact/getTagInfo`,
        {
          params: {
            accountId,
            channelId,
            contactId,
          },
        },
      );

      if (tagResponse.data?.success) {
        const tagGroupList = tagResponse.data.result?.tagGroupList || [];
        console.log("tagGroupList", tagResponse.data.result);
        const userTags = [];
        for (const group of tagGroupList) {
          if (group.tags && Array.isArray(group.tags)) {
            for (const tag of group.tags) {
              if (tag.name) userTags.push(tag.name);
            }
          }
        }

        logger.info(
          { contactId, userTags },
          '[Gateway/WeTinker] User tag list retrieved for routing',
        );

        let matchedEmployeeId = null;
        let wildcardEmployeeId = null;

        // 遍历匹配规则
        for (const route of tagRoutes) {
          if (!route.employeeId || !route.tags) continue;
          
          const ruleTags = route.tags
            .split('|')
            .map((t) => t.trim())
            .filter((t) => t.length > 0);

          // 记录通配符规则
          if (ruleTags.includes('*')) {
            wildcardEmployeeId = route.employeeId;
          }

          // 精确匹配：用户有任何一个 tag 命中规则列表
          const isMatched = userTags.some((tag) => ruleTags.includes(tag));
          if (isMatched) {
            matchedEmployeeId = route.employeeId;
            break; // 优先精确匹配，找到即终止
          }
        }

        // 如果没有精确匹配，使用通配符兜底
        if (!matchedEmployeeId && wildcardEmployeeId) {
          logger.info(
            { contactId, wildcardEmployeeId },
            '[Gateway/WeTinker] Precision match failed, routing to wildcard fallback employee',
          );
          matchedEmployeeId = wildcardEmployeeId;
        }

        if (matchedEmployeeId) {
          logger.info(
            { contactId, matchedEmployeeId },
            '[Gateway/WeTinker] Dynamic route matched successfully',
          );
          return matchedEmployeeId;
        } else {
          logger.info(
            { contactId, userTags },
            '[Gateway/WeTinker] Inbound message dropped because tags do not match any routing rules',
          );
          return null;
        }
      } else {
        logger.warn(
          { data: tagResponse.data },
          '[Gateway/WeTinker] Failed to fetch tag info, dropping message to be safe',
        );
        return null;
      }
    } catch (error) {
      logger.error(
        { error: error.message },
        '[Gateway/WeTinker] Error fetching tag info, blocking message processing',
      );
      return null;
    }
  }
}

export default new WeTinkerProvider();
