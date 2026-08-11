// 数据分析Agent核心节点函数
// agentNode: 负责理解用户意图，规划下一步行动
import { createLLM } from '../llm/index.js';
import { SystemMessage, AIMessageChunk } from '@langchain/core/messages';
import prompts from './prompts/dataAnalysis.js';
import { getBuiltinToolConfig } from '../tools/index.js';
import { openAITools } from '../utils/tool_utils.js';
import { extractStateJson, extractMongoQuery, extractQueryComponents } from './extractUtils.js';
import { eventType } from './index.js';
import { dispatchEvent } from '../../utils/langgraphUtils.js';
const { PROMPT_DATA_ANALYSIS } = prompts;

export const availableTools = [
  getBuiltinToolConfig('get_available_forms'),
  getBuiltinToolConfig('get_schema_by_name'),
  getBuiltinToolConfig('get_schema_by_id'),
  // getBuiltinToolConfig('get_chart_query_template'),
];

const agentNode = async function (state) {
  // 仅在首次添加系统提示，避免重复膨胀上下文
  const hasSystem = state.messages.some((m) => m instanceof SystemMessage);

  // 初始化模型并绑定工具 (移动到函数内部以获取 userId/appId 进行计费)
  const model = createLLM('openai', {
    userId: state.userId,
    appId: state.appId,
    runName: 'data_analysis',
    taskId: state.taskId || state.sessionId || `${state.userId}_${Date.now()}`,
  })
    .bindTools(openAITools(availableTools))
    .withConfig({
      runName: 'DataAnalysisAgentRun',
    });
  const promptMsg = new SystemMessage({
    content: PROMPT_DATA_ANALYSIS.replace(
      '{{current_state}}',
      JSON.stringify(state.taskState, null, 2),
    ),
  });
  const messages = hasSystem ? state.messages : [promptMsg, ...state.messages];

  console.log('messages=========》', messages);
  const stream = await model.stream(messages);
  let response = new AIMessageChunk({ content: '' });

  // 高效索引扫描流式解析器
  let currentTag = ''; // '', 'think', 'message', 'intent'
  let leftover = ''; // 累计未处理的字符串
  let intentBuffer = ''; // 专门存储 intent JSON

  const TAGS = {
    THINK: '<think>',
    THINK_END: '</think>',
    MESSAGE: '<message>',
    MESSAGE_END: '</message>',
    INTENT: '<intent>',
    INTENT_END: '</intent>',
  };

  const VALID_PREFIXES = Object.values(TAGS);
  const MAX_TAG_LEN = 12; // 足够容纳最长的标签如 </message>

  const dispatchContent = async (content) => {
    if (!content) return;
    if (currentTag === 'think') {
      await dispatchEvent(eventType.TRUNK, { content, type: 'thought' });
    } else if (currentTag === 'intent') {
      intentBuffer += content;
    } else {
      // 默认（包括 message 标签内和标签外的文字）都作为 Response 发送
      await dispatchEvent(eventType.TRUNK, { content, type: 'Response' });
    }
  };

  for await (const chunk of stream) {
    if (chunk.tool_call_chunks) {
      chunk.tool_call_chunks = chunk.tool_call_chunks.map((tc) => {
        if (tc.name === '') delete tc.name;
        if (tc.id === '') delete tc.id;
        return tc;
      });
    }
    const chunkContent = chunk.content || '';
    response = response.concat(chunk);
    leftover += chunkContent;

    // 循环处理解析器缓冲区
    while (leftover.length > 0) {
      const nextTagIndex = leftover.indexOf('<');

      // 1. 如果没有看到 < 符号
      if (nextTagIndex === -1) {
        // 如果长度很大，为安全起见发送大部分内容（为了实时感），保留一小部分以处理被截断的标签
        if (leftover.length > MAX_TAG_LEN) {
          const flushLen = leftover.length - MAX_TAG_LEN;
          await dispatchContent(leftover.slice(0, flushLen));
          leftover = leftover.slice(flushLen);
        }
        break; // 等待后续 chunk
      }

      // 2. 如果 < 符号不在开头，先发送之前的内容
      if (nextTagIndex > 0) {
        await dispatchContent(leftover.slice(0, nextTagIndex));
        leftover = leftover.slice(nextTagIndex);
      }

      // 3. 现在 leftover 肯定是以 < 开头，尝试匹配标签
      let matched = false;
      for (const [key, tag] of Object.entries(TAGS)) {
        if (leftover.startsWith(tag)) {
          // 匹配成功
          if (tag === TAGS.THINK) currentTag = 'think';
          else if (tag === TAGS.THINK_END) currentTag = '';
          else if (tag === TAGS.MESSAGE) currentTag = 'message';
          else if (tag === TAGS.MESSAGE_END) currentTag = '';
          else if (tag === TAGS.INTENT) {
            currentTag = 'intent';
            intentBuffer = '';
          } else if (tag === TAGS.INTENT_END) currentTag = '';

          leftover = leftover.slice(tag.length);
          matched = true;
          break;
        }
      }

      if (matched) continue;

      // 4. 如果没匹配全，检查是否可能是标签前缀
      const isPossiblePrefix = VALID_PREFIXES.some((p) => p.startsWith(leftover));

      if (isPossiblePrefix && leftover.length < MAX_TAG_LEN) {
        // 可能是截断的标签，等待更多数据
        break;
      } else {
        // 肯定不是合法标签或超过长度限制，把 < 吐出来作为普通字符处理
        await dispatchContent('<');
        leftover = leftover.slice(1);
      }
    }
  }

  // 流结束，处理最后一丁点残留
  if (leftover) {
    await dispatchContent(leftover);
  }

  // 从收集到的 intentBuffer 中尝试解析最新的状态
  let statePatch = null;
  if (intentBuffer) {
    try {
      statePatch = JSON.parse(intentBuffer.trim());
    } catch (e) {
      console.error('高效流解析器：未能解析 intent JSON', e);
      statePatch = extractStateJson(response.content);
    }
  } else {
    statePatch = extractStateJson(response.content);
  }

  if (statePatch) {
    console.log('解析到的状态补丁:', statePatch);
  }

  // 分发助手完成事件（包含工具调用）
  await dispatchEvent(eventType.Assistants, {
    content: response.content,
    tool_calls: response.tool_calls,
  });

  return { messages: [response], taskState: statePatch || {} };
};

export default agentNode;
