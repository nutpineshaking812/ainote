import { ProtocolStreamer } from '../../../utils/stream.protocol.js';
import { EMPLOYEE_SCENARIOS } from '../../../constants/digitalEmployee.js';

/**
 * AI Service 基础基类
 * 提供统一的会话管理、流控逻辑接口
 */
export class AIBaseService {
  constructor({ userId, appId, scenario = EMPLOYEE_SCENARIOS.GENERAL, enablePersistence = true }) {
    this.userId = userId?.toString();
    this.appId = appId?.toString();
    this.scenario = scenario;
    this.enablePersistence = enablePersistence;
  }

  /**
   * 确保会话存在并获取元数据
   */
  async getOrPrepareConversation(conversationId, options = {}) {
    const { ensureConversation } = await import('../../conversationService.js');
    const { conversation } = await ensureConversation(conversationId, {
      userId: this.userId,
      appId: this.appId,
      scenario: this.scenario,
      message: options.initialMessage || '',
    });
    return conversation;
  }

  /**
   * 抽象方法：执行 Agent 逻辑并产生标准化事件流
   */
  async *executeAgent(params) {
    throw new Error('executeAgent must be implemented by subclass');
  }

  /**
   * 将 Agent 的特定事件流映射到标准化流事件
   */
  async *mapEventsToStandardStream(agentStream) {
    for await (const event of agentStream) {
      yield event;
    }
  }

  /**
   * 统一的流响应入口
   * 封装了 Vercel AI SDK 协议和 SSE 处理逻辑
   */
  async streamResponse(writer, options = {}) {
    const {
      conversationId,
      message,
      executeAgent,
      enablePersistence = this.enablePersistence,
    } = options;

    let assistantMessageId = null;

    // 4. 初始化标准化协议流与消息缓冲区
    const streamer = new ProtocolStreamer(writer);
    streamer.startHeartbeat();
    const messageBuffer = new MessageBuffer(); // 用于持久化聚合

    // 5. 开启推理生命周期
    streamer._emitStart();
    
    // 监听连接断开，用于中断循环
    const res = writer.res;
    let isDisconnected = false;
    let agentGeneratorInstance = null;
    
    const onDisconnect = () => {
      isDisconnected = true;
      console.log('[AIBaseService] HTTP Connection close event triggered. Active assistantMessageId:', assistantMessageId);
      if (agentGeneratorInstance && typeof agentGeneratorInstance.return === 'function') {
        console.log('[AIBaseService] Proactively calling agentGeneratorInstance.return() to trigger finally block');
        agentGeneratorInstance.return().then(() => {
          console.log('[AIBaseService] agentGeneratorInstance.return() completed successfully');
        }).catch(err => {
          console.error('[AIBaseService] Error while calling generator return:', err);
        });
      } else {
        console.warn('[AIBaseService] Connection closed but no active generator instance or return method found');
      }
    };
    res?.on('close', onDisconnect);

    try {
      const agentGenerator = executeAgent || this.executeAgent.bind(this);
      agentGeneratorInstance = agentGenerator({ ...options, writer });

      // 将所有 options 传给 agentGenerator，子类可以从中提取需要的参数 (如 messages, toolDefinitions)
      for await (const event of agentGeneratorInstance) {
        if (isDisconnected) {
          console.log('[AIBaseService] Client disconnected, breaking generator loop (secondary safety check)');
          break; 
        }

        // 1. 发送：由 Streamer 自动处理协议转化与发送
        streamer.absorbWorkflowEvent(event);

        // 2. 持久化：聚合文本段
        if (enablePersistence) {
          const et = event.status || event.type;
          if (et === 'text-delta' || et === 'trunk') {
            const text = event.content || (typeof event.data === 'string' ? event.data : event.data?.content) || '';
            if (text) messageBuffer.addTextDelta(text, event.data?.type || 'assistant');
          } else if (et === 'thinking-delta') {
            const text = event.content || (event.data && typeof event.data === 'string' ? event.data : event.data?.content) || '';
            if (text) messageBuffer.addTextDelta(text, 'thought');
          } else if (et === 'data' || et === 'chart') {
            const chartData = event.data || event.content;
            if (chartData) messageBuffer.addSegment({ type: 'chart_data', content: chartData });
          }
        }
      }

      streamer.finish('stop');
    } catch (error) {
      console.error('[AIBaseService] Stream Error:', error);
      streamer.emitError(error.message);
    } finally {
      res?.off('close', onDisconnect);
      if (enablePersistence && assistantMessageId) {
        const segments = messageBuffer.getSegments();
        if (segments.length > 0) {
          try {
            const { appendMessageSegments } = await import('../../conversationService.js');
            await appendMessageSegments(assistantMessageId, segments);
          } catch (dbError) {
            console.error('[AIBaseService] Persistence Error:', dbError);
          }
        }
      }
      streamer.close();
    }
  }
}

/**
 * 内部消息缓冲区，用于在流式传输过程中聚合文本段
 */
class MessageBuffer {
  constructor() {
    this.segments = [];
    this.currentText = '';
    this.currentType = null;
  }

  addTextDelta(delta, type = 'assistant') {
    if (this.currentType && this.currentType !== type) {
      this.flushText();
    }
    this.currentText += delta;
    this.currentType = type;
  }

  addSegment(segment) {
    this.flushText();
    this.segments.push(segment);
  }

  flushText() {
    if (this.currentText) {
      this.segments.push({
        type: this.currentType === 'thought' ? 'thought' : 'assistant',
        content: this.currentText,
      });
      this.currentText = '';
    }
  }

  getSegments() {
    this.flushText();
    return this.segments;
  }
}
