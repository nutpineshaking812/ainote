import api from './index';

export const installMcpServer = async (data) => {
  return api.post('/mcp', data);
};

export const getMcpServers = async (orgId) => {
  return api.get(`/mcp?organizationId=${orgId}`);
};

export const refreshMcpServer = async (id) => {
  return api.post(`/mcp/${id}/refresh`);
};

export const deleteMcpServer = async (id) => {
  return api.delete(`/mcp/${id}`);
};

export const updateMcpStatus = async (id, status) => {
  return api.patch(`/mcp/${id}`, { status });
};
