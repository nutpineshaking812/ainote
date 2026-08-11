import api from './index';

/**
 * Get available AI models from backend
 * @returns {Promise<any>}
 */
export const getAvailableModels = async () => {
  return api.get('/ai/models');
};

// Agent's ai_memory documents (Deep Agent)
export const getAgentMemoryList = async (appId) => {
  return api.get(`/ai/agent-memory/${appId}/list`);
};

export const getAgentMemoryContent = async (appId, docId) => {
  return api.get(`/ai/agent-memory/${appId}/${docId}`);
};

export default {
  getAvailableModels,
  getAgentMemoryList,
  getAgentMemoryContent,
};
