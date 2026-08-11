// 数据分析Agent核心节点函数
// agentNode: 负责理解用户意图，规划下一步行动
import { createLLM } from '../llm/index.js';
import { SystemMessage, AIMessageChunk, ToolMessage } from '@langchain/core/messages';
import { getBuiltinToolConfig } from '../tools/index.js';
import { openAITools } from '../utils/tool_utils.js';
import { eventType } from '../index.js';
import { dispatchEvent } from '../../utils/langgraphUtils.js';
import prompts from './prompts/general.js';

const { PROMPT_GENERAL } = prompts;

export const availableTools = [
  getBuiltinToolConfig('get_document'),
  getBuiltinToolConfig('get_template_content')
];

export const agentNode = async function (state) {
  const hasSystem = state.messages.some((m) => m instanceof SystemMessage);
  const refs = state.refs || [];

  // 初始化模型并绑定工具 (移动到函数内部以获取 userId/appId 进行计费)
  const baseModel = createLLM('qwen', {
    enable_thinking: false,
    userId: state.userId,
    appId: state.appId,
    runName: 'general_chat',
    taskId: state.taskId || state.sessionId || `${state.userId}_${Date.now()}`,
  });

  const model = baseModel.bindTools(openAITools(availableTools)).withConfig({
    runName: 'general',
  });

  let userPrompt = '';
  if (state.messages.length > 0) {
    const templateMarkdowns = [];
    for (let i = state.messages.length - 1; i >= 0; i -= 1) {
      const message = state.messages[i];
      if (!(message instanceof ToolMessage)) break;
      if (message.name !== 'get_template_content' || !message.content) continue;

      try {
        const parsedContent = JSON.parse(message.content);
        if (parsedContent?.markdown) {
          templateMarkdowns.unshift(parsedContent);
        }
      } catch (error) {
        console.warn('解析模板内容失败：', error);
      }
    }

    if (templateMarkdowns.length > 0) {
      userPrompt = templateMarkdowns
        .map(
          (json) => `
------
从模板工具获取的「${json.name}」的内容。请结合以上要求并基于此内容和用户请求进行回答，内容是：
${json.markdown}
------`,
        )
        .join('\n\n');
    }
  }

  const baseSystemPrompt = PROMPT_GENERAL.replace(
    '{{refs}}',
    JSON.stringify(refs, null, 2),
  ).replace('{{docId}}', state.docId || 'None');

  const finalSystemPrompt = `${baseSystemPrompt}${userPrompt}`;

  const messages = hasSystem
    ? state.messages
    : [new SystemMessage(finalSystemPrompt), ...state.messages];
  // console.log('messages', messages);

  const stream = await model.stream(messages);
  let response;
  for await (const chunk of stream) {
    if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
      for (const tc of chunk.tool_call_chunks) {
        if (tc.name === '') delete tc.name; // 注意：必须是 delete，不能赋值为 null
        if (tc.id === '') delete tc.id;
      }
    }
    response = response ? response.concat(chunk) : chunk;
    // console.log('chunk=========>', chunk);
    const chunkContent = chunk.content || '';
    if (chunkContent.length > 0) {
      dispatchEvent(eventType.TRUNK, { content: chunkContent, type: 'Response' });
    }
  }
  // console.log('最终响应结果：', response);
  if (response.tool_calls && response.tool_calls.length > 0) {
    dispatchEvent(eventType.Assistants, {
      content: response.content,
      tool_calls: response.tool_calls,
    });
    console.log('工具调用信息：', response.tool_calls);
  } else {
    dispatchEvent(eventType.Assistants, {
      content: response.content,
      tool_calls: response.tool_calls,
    });
    console.log('常规回答：', response.content);
  }
  return { messages: [response] };
};

export default agentNode;
