/**
 * AgentEventEmitter: 类型安全的 SSE 事件发送器
 * 封装了符合标准格式的 SSE 事件发送逻辑
 */
export class AgentEventEmitter {
  constructor(res) {
    this.res = res;
    this.closed = false;
    this.heartbeatInterval = null;
  }

  /**
   * 开始心跳，防止连接超时
   * @param {number} interval - 心跳间隔(ms)，默认 15s
   */
  startHeartbeat(interval = 3000) {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      if (!this.closed) {
        // SSE 规范：以冒号开头的行是注释，会被浏览器忽略但能维持连接
        this.res.write(': heartbeat\n\n');
      }
    }, interval);
  }

  /**
   * 发送 SSE 事件
   * @param {string} event - 事件名称
   * @param {Object} data - 事件数据
   */
  emit(event, data) {
    if (this.closed) return;
    this.res.write(`event: ${event}\n`);
    this.res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  /**
   * 发送文本增量事件 (text-delta)
   * @param {string} content - 文本内容
   */
  emitTextDelta(content) {
    this.emit('text-delta', { content });
  }

  /**
   * 发送工具调用事件 (tool-call)
   */
  emitToolCall(toolName, args, toolCallId) {
    this.emit('tool-call', { toolName, args, toolCallId });
  }

  /**
   * 发送工具结果事件 (tool-result)
   */
  emitToolResult(toolName, result, toolCallId) {
    this.emit('tool-result', { toolName, result, toolCallId });
  }

  /**
   * 发送完整消息片段 (trunk)
   */
  emitTrunk(content, type = 'Response') {
    this.emit('trunk', { content, type });
  }

  /**
   * 发送图表数据 (chart)
   */
  emitChart(data) {
    this.emit('chart', { data });
  }

  /**
   * 发送会话元数据 (conversation)
   */
  emitConversation(id, title) {
    this.emit('conversation', { id, title });
  }

  /**
   * 发送错误事件 (error)
   */
  emitError(error) {
    this.emit('error', { error });
  }

  /**
   * 发送完成事件 (finish)
   */
  emitFinish(reason = 'stop') {
    this.emit('finish', { reason });
  }

  /**
   * 关闭流
   */
  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.res.end();
  }
}
