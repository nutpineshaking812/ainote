import api from './index';

/**
 * 协同项目组 Frontend API 交互层
 */

export const getAgentTeams = async (appId) => {
  return api.get(`/apps/${appId}/agent-teams/get-list`);
};

export const createAgentTeam = async (appId, { name, ceoEmployeeId, memberEmployeeIds, conversationId }) => {
  return api.post(`/apps/${appId}/agent-teams/create`, {
    name,
    ceoEmployeeId,
    memberEmployeeIds,
    conversationId,
  });
};

export const deleteAgentTeam = async (appId, id) => {
  return api.post(`/apps/${appId}/agent-teams/delete`, { id });
};
