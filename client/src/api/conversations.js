import api from './index';

/**
 * List conversations by appId and optional type.
 * @param {string} appId
 * @param {Object} opts { type, page, limit }
 * @returns {Promise<Object>} { items, pagination }
 */
export const listConversations = async (appId, opts = {}) => {
  if (!appId) throw new Error('appId required');
  const { type, page, limit, targetId, employeeId, scenario } = opts;
  const params = new URLSearchParams();
  if (type) params.append('type', type);
  if (page) params.append('page', page);
  if (limit) params.append('limit', limit);
  if (targetId) params.append('targetId', targetId);
  if (employeeId) params.append('employeeId', employeeId);
  if (scenario) params.append('scenario', scenario);

  return api.get(`/conversations/apps/${appId}`, { params });
};

/**
 * Get messages for a conversation.
 * @param {string} conversationId
 * @returns {Promise<Object>} { messages }
 */
export const getConversationMessages = async (conversationId) => {
  if (!conversationId) throw new Error('conversationId required');
  return api.get(`/conversations/${conversationId}/messages`);
};

/**
 * Update conversation title
 * @param {string} conversationId
 * @param {string} title
 */
export const updateConversationTitle = async (conversationId, title) => {
  if (!conversationId) throw new Error('conversationId required');
  return api.post(`/conversations/${conversationId}/title`, { title });
};
