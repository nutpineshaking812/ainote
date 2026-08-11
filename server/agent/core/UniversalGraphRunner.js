/**
 * 通用 LangGraph 运行器
 * 负责执行图并将其原始事件流映射为系统标准化的事件
 */
export class UniversalGraphRunner {
  /**
   * @param {Object} graph - 已编译的 LangGraph 实例
   */
  constructor(graph) {
    this.graph = graph;
  }

  /**
   * 运行图并生成标准化流事件
   * @param {Object} inputState - 初始状态
   * @param {Object} options - 运行配置
   */
  async *run(inputState, options = {}) {
    try {
      const stream = this.graph.streamEvents(inputState, {
        version: 'v2',
        ...options.config,
      });

      let currentToolCallId = null;
      let currentToolName = null;
      let toolInputStartSent = false;

      for await (const event of stream) {
        const { event: eventType, data, name } = event;
        // console.log('event', event);

        // 1. 处理自定义事件 (由 dispatchCustomEvent 触发)
        if (eventType === 'on_custom_event') {
          yield { type: name, data: data, ...data };
          continue;
        }

        // 2. 处理模型流输出
        if (eventType === 'on_chat_model_stream') {
          const chunk = data?.chunk;

          // 记录工具调用身份（ID 和 名称 通常随第一个 chunk 到达）
          if (chunk?.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
            const tc = chunk.tool_call_chunks[0];
            // 当 toolCallId 变化时（新工具调用开始），重置标记以发送 tool-input-start
            if (tc.id && tc.id !== currentToolCallId) {
              currentToolCallId = tc.id;
              currentToolName = tc.name || currentToolName;
              toolInputStartSent = false;
            }

            if (!toolInputStartSent && currentToolCallId) {
              yield {
                type: 'tool-input-start',
                toolCallId: currentToolCallId,
                toolName: currentToolName,
              };
              toolInputStartSent = true;
            }
          }

          // 文本增量
          if (chunk?.content) {
            yield { type: 'text-delta', content: chunk.content };
          }

          // 工具调用增量
          if (chunk?.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
            for (const tcChunk of chunk.tool_call_chunks) {
              if (tcChunk.args) {
                yield {
                  type: 'tool-input-delta',
                  toolCallId: tcChunk.id || currentToolCallId,
                  inputTextDelta: tcChunk.args,
                };
              }
            }
          }
        }

        if (eventType === 'on_chat_model_end') {
          yield { type: 'finish-step' };
          toolInputStartSent = false;
          continue;
        }

        // 3. 处理工具执行事件 (用于展示进度)
        if (eventType === 'on_tool_start') {
          currentToolCallId = event.run_id || data?.id;
          currentToolName = name || data?.name;
          yield {
            type: 'tool-input-start',
            toolCallId: currentToolCallId,
            toolName: currentToolName,
          };
          toolInputStartSent = true;
        }

        if (eventType === 'on_tool_end') {
          yield {
            type: 'tool-input-available',
            toolCallId: event.run_id || currentToolCallId,
            toolName: name || data?.name || currentToolName,
            input: data?.output,
          };
          // 重置状态
          toolInputStartSent = false;
          currentToolCallId = null;
          currentToolName = null;
        }
      }
    } catch (err) {
      console.error('[UniversalGraphRunner] Error:', err);
      yield { type: 'error', error: err.message || 'AI 运行异常' };
    }
  }
}
