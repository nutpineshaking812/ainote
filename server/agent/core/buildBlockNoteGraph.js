import { createLLM } from '../llm/index.js';
import { HumanMessage, AIMessage, AIMessageChunk, SystemMessage } from '@langchain/core/messages';

/**
 * 简化的 BlockNote AI - 单次工具调用
 * 不使用 LangGraph 循环，直接调用 LLM 并强制使用工具
 */
export async function* runBlockNoteGraph(
  processedMessages,
  toolDefinitions,
  systemPrompt,
  options = {},
) {
  const { userId, appId } = options;
  const llm = createLLM('openai', {
    enable_search: false,
    enable_thinking: false,
    userId,
    appId,
    runName: 'blocknote_ai',
    taskId: options?.taskId || `bn_${userId}_${Date.now()}`,
  });
  // 转换工具定义
  const convertToOpenAITool = (name, toolDef) => ({
    type: 'function',
    function: {
      name: name,
      // 确保有描述，否则部分模型会报错
      description: toolDef.description || `Tool for ${name}`,
      // 核心：剥离掉 inputSchema 和 jsonSchema 外壳
      parameters: toolDef.inputSchema.jsonSchema,
    },
  });

  const tools = Object.entries(toolDefinitions).map(([name, def]) =>
    convertToOpenAITool(name, def),
  );
  const llmWithTools = tools.length > 0 ? llm.bindTools(tools, { tool_choice: 'required' }) : llm;

  const initialMessages = processedMessages.map((msg) => {
    // 从 parts 数组中提取文本内容
    let content = '';
    if (msg.parts && Array.isArray(msg.parts)) {
      // 合并所有 text 类型的 parts
      content = msg.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n');
    } else if (msg.content) {
      // 兼容简单的 content 字段
      content = msg.content;
    }

    if (msg.role === 'system') {
      return new SystemMessage({ content });
    } else if (msg.role === 'assistant') {
      return new AIMessage({ content });
    } else {
      // user 消息
      return new HumanMessage({ content });
    }
  });

  // 单次调用 LLM（流式）
  const stream = await llmWithTools.stream(initialMessages, {
    tool_choice: 'required',
  });

  let response = new AIMessageChunk({ content: '' });

  for await (const chunk of stream) {
    // 清理空的 tool_call_chunks
    if (chunk.tool_call_chunks) {
      chunk.tool_call_chunks = chunk.tool_call_chunks.map((tc) => {
        if (tc.name === '') delete tc.name;
        if (tc.id === '') delete tc.id;
        return tc;
      });
    }

    // 合并 chunks（用于获取完整的 tool_calls）
    response = response.concat(chunk);

    yield {
      event: 'on_chat_model_stream',
      data: {
        chunk: chunk, // 原始 chunk，包含增量的 tool_call_chunks
        response: response, // 合并后的 response，包含完整的 tool_calls
      },
    };
  }

  if (response.tool_calls && response.tool_calls.length > 0) {
    for (const toolCall of response.tool_calls) {
      yield {
        event: 'on_tool_end',
        data: {
          id: toolCall.id,
          name: toolCall.name,
          output: JSON.stringify({ args: toolCall.args }), // 将参数包装成输出格式
        },
      };
    }
  }
}
