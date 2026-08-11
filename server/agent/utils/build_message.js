import { tool } from '@langchain/core/tools';
import { getRecentMessages, segmentsToPlainText } from '../../services/conversationService.js';
import { logger } from '../../config/logger.js';
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  FunctionMessage,
  ToolMessage,
} from '@langchain/core/messages';

export const buildHistoryMessage = async (conversationId) => {
  logger.debug({ conversationId }, 'buildHistoryMessage');
  if (conversationId) {
    try {
      // ToDo： 后续需要优化获取历史数据逻辑，避免重复获取过多无关消息
      // Loading historical messages for analysis session from conversation
      // getRecentMessages -> findRecentWithSegments 内部已 .reverse() 返回时间正序(旧→新)，
      // 此处无需再次 reverse，避免双重反转导致顺序颠倒
      const recentMessages = await getRecentMessages(conversationId, { limit: 60 });
      const ordered = Array.isArray(recentMessages) ? recentMessages : [];
      const normalizeToolCalls = (tcs) => {
        if (!Array.isArray(tcs)) return [];
        return tcs.map((tc) => {
          if (!tc.args) {
            tc.args = {};
          }
          return tc;
        });
      };

      // Map DB message docs to LangChain message instances so downstream agent nodes get typed messages
      const historyMessages = ordered.map((m) => {
        const meta = { id: m._id?.toString?.(), createdAt: m.createdAt };
        const content = segmentsToPlainText(m.segments);
        switch ((m.role || '').toLowerCase()) {
          // case 'system':
          //   return new SystemMessage({ content: m.content, additional_kwargs: meta });
          case 'assistant':
            if (m.tool_calls && m.tool_calls.length > 0) {
              const tcs = normalizeToolCalls(m.tool_calls);
              return new AIMessage({
                content: content,
                tool_calls: tcs,
                additional_kwargs: {
                  ...meta,
                  tool_call_id: m.tool_call_id,
                  tool_calls: tcs,
                },
              });
            } else {
              return new AIMessage({
                content: content,
                additional_kwargs: {
                  ...meta,
                  tool_call_id: m.tool_call_id,
                },
              });
            }
          case 'tools':
          case 'function':
          case 'tool':
            return new ToolMessage({
              name: m.tool_name || undefined,
              tool_call_id: m.tool_call_id,
              content: content,
              additional_kwargs: meta,
            });
          case 'user':
          default:
            return new HumanMessage({ content: content, additional_kwargs: meta });
        }
      });

      // 过滤掉空内容的消息（如只有 thought/tool_call 的 assistant 消息）
      return historyMessages.filter((msg) => {
        const content = msg.content;
        if (content === '' || content === null || content === undefined) return false;
        if (Array.isArray(content) && content.length === 0) return false;
        return true;
      });
    } catch (e) {
      // ignore
      logger.error({ err: e }, 'buildHistoryMessage error');
    }
    return [];
  }
  return [];
};
