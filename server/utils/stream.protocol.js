/**
 * SSEWriter - 负责处理标准浏览器 HTTP SSE 协议
 */
export class SSEWriter {
  constructor(res) {
    this.res = res;
    this.heartbeatInterval = null;
    this.setupHeaders();
  }

  setupHeaders() {
    if (this.res.headersSent) return;
    this.res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    this.res.setHeader('Cache-Control', 'no-cache');
    this.res.setHeader('Connection', 'keep-alive');
    this.res.setHeader('X-Accel-Buffering', 'no');
    if (typeof this.res.flushHeaders === 'function') {
      this.res.flushHeaders();
    }
  }

  startHeartbeat(interval = 15000) {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      if (typeof this.res.write === 'function') {
        this.res.write(': h\n\n');
      }
    }, interval);
  }

  write(type, body) {
    if (typeof this.res.write !== 'function') return;
    const data = JSON.stringify({ type, ...body });
    this.res.write(`data: ${data}\n\n`);
  }

  finish() {
    if (typeof this.res.write === 'function') {
      this.res.write('data: [DONE]\n\n');
    }
  }

  end() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (typeof this.res.end === 'function') {
      this.res.end();
    }
  }
}

/**
 * GatewayWriter - 负责处理机器人/**
 * 网关专用的数据写入适配器
 */
export class GatewayWriter {
  constructor(sessionId, executionId, sender = null) {
    this.sessionId = sessionId;
    this.executionId = executionId;
    this.sender = sender;
  }

  startHeartbeat() {}

  async write(type, body) {
    if (this.sender && typeof this.sender.write === 'function') {
      await this.sender.write(type, body);
      return;
    }

    const { default: gatewayService } = await import('../services/gateway/gateway.service.js');
    await gatewayService.send(this.sessionId, { type, executionId: this.executionId, ...body });
  }

  finish() {}

  end() {}
}

/**
 * ProtocolStreamer
 * 标准化流协议状态机。
 * 建议使用 absorbWorkflowEvent 作为主要业务入口。
 */
export class ProtocolStreamer {
  constructor(target) {
    if (target && typeof target.setHeader === 'function' && typeof target.write === 'function') {
      this.writer = new SSEWriter(target);
    } else {
      this.writer = target;
    }
    this.closed = false;
    this.stepCounter = 0;
    this.isStepActive = false;
  }

  // =====================================================================
  // 公开控制方法
  // =====================================================================

  startHeartbeat(interval) {
    if (this.writer.startHeartbeat) {
      this.writer.startHeartbeat(interval);
    }
  }

  emitError(error, extra = {}) {
    const message = typeof error === 'string' ? error : error?.message || 'Unknown Error';
    this._emit('error', { error: message, content: message, errorText: message, ...extra });
  }

  finish(reason = 'stop') {
    if (this.closed) return;
    this._emit('finish', { finishReason: reason });
    if (this.writer.finish) this.writer.finish();
    this.close();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.writer.end) {
      this.writer.end();
    }
  }

  /**
   * [首席接口] 协议吸收器
   * 外部服务应优先使用此方法分发工作流事件。
   */
  absorbWorkflowEvent(event) {
    if (!event) return null;

    const {
      type: rawType,
      status,
      content,
      data,
      toolName,
      toolCallId,
      result,
      inputTextDelta,
      input,
      error,
    } = event;

    const eventType = status || rawType;

    // 自动步骤管理
    if (!this.isStepActive && this._isPayloadEvent(eventType)) {
      this._emitStartStep();
      this.isStepActive = true;
      if (eventType === 'start-step') return { type: 'start-step' };
    }

    let protocolResult = null;
    switch (eventType) {
      case 'text-delta':
      case 'trunk': {
        const text = content || (typeof data === 'string' ? data : data?.content) || '';
        if (text) {
          this._emitTextDelta(text);
          protocolResult = { type: 'text-delta', content: text };
        }
        break;
      }
      case 'thinking-delta': {
        const text = content || (data && typeof data === 'string' ? data : data?.content) || '';
        if (text !== undefined && text !== null) {
          this._emitThinkingDelta(text);
          protocolResult = { type: 'thinking-delta', content: text };
        }
        break;
      }
      case 'finish-step':
        this._emitFinishStep();
        this.isStepActive = false;
        protocolResult = { type: 'finish-step' };
        break;
      case 'start-step':
        this.isStepActive = true;
        protocolResult = { type: 'start-step' };
        break;
      case 'tool-input-start':
        this._emitToolInputStart(toolCallId, toolName);
        protocolResult = { type: 'tool-input-start', toolCallId, toolName };
        break;
      case 'tool-input-delta':
        const delta = inputTextDelta || content || '';
        this._emitToolInputDelta(toolCallId, toolName, delta);
        protocolResult = { type: 'tool-input-delta', toolCallId, toolName, content: delta };
        break;
      case 'tool-input-available':
        this._emitToolInputAvailable(toolCallId, toolName, input);
        protocolResult = { type: 'tool-input-available', toolCallId, toolName, input };
        break;
      case 'tool-call':
        const tArgs = typeof args === 'string' ? args : JSON.stringify(args || {});
        this._emitToolInputDelta(toolCallId || 'call_' + Date.now(), toolName, tArgs);
        protocolResult = { type: 'tool-input-delta', toolCallId, toolName, content: tArgs };
        break;
      case 'tool-result':
        this._emitToolOutputAvailable(toolCallId, toolName, result);
        protocolResult = { type: 'tool-result', toolCallId, toolName, result };
        break;
      case 'chart':
      case 'data':
        const chartData = data || content;
        // To comply with Vercel AI SDK protocol, emit type: 'data' wrapping type: 'chart'
        this._emit('data', {
          data: {
            type: 'chart',
            data: chartData,
            segmentId: event.segmentId,
            messageId: event.messageId,
            assistantMessageId: event.assistantMessageId,
          }
        });
        protocolResult = {
          type: 'data',
          content: {
            type: 'chart',
            data: chartData,
            segmentId: event.segmentId,
            messageId: event.messageId,
            assistantMessageId: event.assistantMessageId,
          }
        };
        break;
      case 'data-conversation':
        this._emit('data-conversation', event);
        protocolResult = { type: 'data-conversation', ...event };
        break;
      case 'workflow:error':
      case 'node:error':
      case 'error':
        this.emitError(error || content, { nodeId: event.nodeId, executionId: event.executionId });
        protocolResult = { type: 'error', content: error || content, nodeId: event.nodeId, executionId: event.executionId };
        break;
      default:
        this._emit(eventType, event);
        protocolResult = { type: eventType, ...event };
    }

    return protocolResult;
  }

  // =====================================================================
  // 内部辅助及底层发射方法 (已标记为私有风格)
  // =====================================================================

  _emit(type, payload = {}) {
    if (this.closed) return;
    this.writer.write(type, payload);
  }

  _isPayloadEvent(type) {
    return [
      'text-delta',
      'thinking-delta',
      'tool-input-delta',
      'trunk',
      'tool-input-start',
      'start-step',
      'tool-result',
      'tool-output-available',
    ].includes(type);
  }

  // _emitNodeProgress(data) { this._emitStreamableData({ type: 'node:progress', ...data }); }
  // _emitWorkflowStart(data) { this._emitStreamableData({ type: 'workflow:start', ...data }); }
  // _emitWorkflowSuccess(data) { this._emitStreamableData({ type: 'workflow:success', ...data }); }
  // _emitWorkflowError(data) { this._emitStreamableData({ type: 'workflow:error', ...data }); }
  // _emitNodeStart(data) { this._emitStreamableData({ type: 'node:start', ...data }); }
  // _emitNodeSuccess(data) { this._emitStreamableData({ type: 'node:success', ...data }); }
  // _emitNodeError(data) { this._emitStreamableData({ type: 'node:error', ...data }); }

  _emitStart() {
    this._emit('start');
  }

  _emitStartStep() {
    this.stepCounter++;
    this._emit('start-step');
  }

  _emitFinishStep() {
    this._emit('finish-step');
  }

  _emitTextDelta(content, extra = {}) {
    if (content === undefined || content === null) return;
    this._emit('text-delta', { content, delta: content, textDelta: content, ...extra });
  }

  _emitThinkingDelta(content, extra = {}) {
    if (content === undefined || content === null) return;
    this._emit('thinking-delta', { content, delta: content, textDelta: content, ...extra });
  }

  _emitToolInputStart(toolCallId, toolName, extra = {}) {
    this._emit('tool-input-start', { toolCallId, toolName, ...extra });
  }

  _emitToolInputDelta(toolCallId, toolName, inputTextDelta, extra = {}) {
    this._emit('tool-input-delta', { toolCallId, toolName, inputTextDelta, ...extra });
  }

  _emitToolOutputAvailable(toolCallId, toolName, result, extra = {}) {
    this._emit('tool-output-available', {
      toolCallId,
      toolName,
      result: typeof result === 'string' ? result : JSON.stringify(result),
      ...extra,
    });
  }

  _emitToolInputAvailable(toolCallId, toolName, input, extra = {}) {
    this._emit('tool-input-available', { toolCallId, toolName, input, ...extra });
  }

  _emitMessageAnnotations(annotations) {
    const arr = Array.isArray(annotations) ? annotations : [annotations];
    this._emit('message-annotations', { annotations: arr });
  }

  _emitStreamableData(data) {
    const arr = Array.isArray(data) ? data : [data];
    this._emit('data', { data: arr });
  }
}

export default ProtocolStreamer;
