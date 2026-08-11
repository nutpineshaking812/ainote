/**
 * Chat DataProvider 工厂
 *
 * 策略模式：将"数据从哪来、怎么获取"封装为可互换的 DataProvider 对象。
 * 消费组件（UnifiedChatWorkspace / ChatProvider / useConversationHistory）
 * 完全不需要感知当前处于内部模式还是开放模式。
 *
 * ── DataProvider 契约 ──
 * {
 *   requestPath: string,                 // SSE 聊天端点路径
 *   loadThreads: () => Promise<items[]>, // 加载会话列表
 *   loadMessages: (convId) => Promise<{ conversation, messages }>, // 加载消息
 * }
 */

import {
  listConversations,
  getConversationMessages,
} from '../../../api/conversations';
import {
  listConversationsOpen,
  getConversationMessagesOpen,
} from '../../../api/openApi';

/**
 * @param {'internal'|'open'}  mode
 * @param {{ appId, employeeId, targetId, scenario }} config
 * @returns {DataProvider}
 */
export function createChatDataProvider(mode, config) {
  if (mode === 'open') {
    return createOpenProvider(config);
  }
  return createInternalProvider(config);
}

// ──────────────── 内部模式 ────────────────

function createInternalProvider({ appId, employeeId, targetId, scenario }) {
  const empId = employeeId?.id || employeeId?._id;

  return {
    requestPath: empId ? `/ai/employ/${empId}/generate` : null,

    loadThreads: async () => {
      if (!appId || !empId) {
        console.warn('[InternalProvider] Missing appId or empId', { appId, empId });
        return [];
      }
      try {
        const data = await listConversations(appId, {
          scenario: scenario || 'DOCUMENT',
          targetId: targetId || undefined,
          employeeId: empId,
          limit: 50,
        });
        return data.items || [];
      } catch (err) {
        console.warn('[InternalProvider] loadThreads failed:', err);
        return [];
      }
    },

    loadMessages: async (convId) => {
      return getConversationMessages(convId);
    },
  };
}

// ──────────────── 开放模式 ────────────────

function createOpenProvider({ appId, employeeId, targetId, scenario }) {
  const empId = employeeId?.id || employeeId?._id;

  const getToken = () => localStorage.getItem('token');

  return {
    requestPath: appId ? `/open/apps/${appId}/employees/chat` : null,

    loadThreads: async () => {
      if (!appId || !empId) {
        console.warn('[OpenProvider] Missing appId or empId', { appId, empId });
        return [];
      }
      const token = getToken();
      if (!token) {
        console.warn('[OpenProvider] No auth token');
        return [];
      }
      try {
        const data = await listConversationsOpen(appId, token, {
          scenario: scenario || 'DOCUMENT',
          targetId: targetId || undefined,
          employeeId: empId,
          limit: 50,
        });
        return data.items || [];
      } catch (err) {
        console.warn('[OpenProvider] loadThreads failed:', err);
        return [];
      }
    },

    loadMessages: async (convId) => {
      const token = getToken();
      if (!token) {
        throw new Error('No auth token for open mode');
      }
      return getConversationMessagesOpen(appId, token, convId);
    },
  };
}

export default createChatDataProvider;
