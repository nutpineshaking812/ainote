import { ToolMessage } from '@langchain/core/messages';
import { safeJsonStringify } from '../../../utils/stringUtils.js';
import { dispatchEvent } from '../../../utils/langgraphUtils.js';
import { eventType } from '../../index.js';

/**
 * 创建通用的工具执行节点
 * @param {Array} availableTools - 可用工具列表
 * @returns {Function} - LangGraph 节点函数
 */
export function createToolExecutorNode(availableTools) {
  return async (state) => {
    const lastMessage = state.messages[state.messages.length - 1];

    if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
      return { messages: [] };
    }

    const messages = [];
    const stateUpdates = {};
    let lastToolError = null;

    for (const toolCall of lastMessage.tool_calls) {
      try {
        const { name, args } = toolCall;
        if (!name) continue;

        dispatchEvent(eventType.TOOL_PLAN, { name, args });

        // 解析工具参数
        const parameters = typeof args === 'string' ? JSON.parse(args) : args;

        // 查找工具对象
        const tool = availableTools.find((t) => t.name === name);
        if (!tool || typeof tool.execute !== 'function') {
          throw new Error(`未找到工具: ${name}`);
        }

        // 执行工具
        const result = await tool.execute(parameters, state);

        // 构建响应内容
        const content = safeJsonStringify(result);
        dispatchEvent(eventType.TOOL_RESULT, { name, content, toolCallId: toolCall.id });

        messages.push(
          new ToolMessage({
            name: name,
            tool_call_id: toolCall.id,
            content,
          }),
        );
        lastToolError = null;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const errorContent = safeJsonStringify({ error: message });

        messages.push(
          new ToolMessage({
            name: toolCall.name,
            tool_call_id: toolCall.id,
            content: errorContent,
          }),
        );

        dispatchEvent(eventType.TOOL_ERROR, {
          name: toolCall.name,
          error: errorContent,
          toolCallId: toolCall.id,
        });

        console.error(`[ToolExecutor] Error in tool ${toolCall.name}:`, message);
        lastToolError = message;
      }
    }

    stateUpdates.lastToolError = lastToolError;
    return {
      messages,
      ...stateUpdates,
    };
  };
}
