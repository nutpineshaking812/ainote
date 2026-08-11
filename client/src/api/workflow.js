import api from './index';

export const getWorkflows = async (params) => {
  return api.get('/workflows', { params });
};

export const getWorkflowById = async (id, params = {}) => {
  return api.get(`/workflows/${id}`, { params });
};

export const getWorkflowInterface = async (id) => {
  return api.get(`/workflows/${id}/interface`);
};

export const createWorkflow = async (data) => {
  return api.post('/workflows', data);
};

export const updateWorkflow = async (id, data) => {
  return api.patch(`/workflows/${id}`, data);
};

export const deleteWorkflow = async (id) => {
  return api.delete(`/workflows/${id}`);
};

export const executeWorkflow = async (id) => {
  return api.post(`/workflows/${id}/execute`);
};

export const streamWorkflowExecute = (id) => {
  return `/workflows/${id}/stream-execute`;
};

export const getWorkflowExecutions = async (id, params) => {
  return api.get(`/workflows/${id}/executions`, { params });
};

export const getExecutionById = async (id, executionId) => {
  return api.get(`/workflows/${id}/executions/${executionId}`);
};

export const debugNode = async (data) => {
  return api.post('/workflows/debug-node', data);
};
export const getSkills = async (appId) => {
  return api.get('/skills', { params: { appId } });
};

export const publishWorkflow = async (id, data) => {
  return api.post(`/workflows/${id}/publish`, data);
};

export const toggleWorkflowStatus = async (id, status) => {
  return await api.post(`/workflows/${id}/status`, { status });
};

export const resetWorkflow = async (id, appId) => {
  return await api.post(`/workflows/${id}/reset`, { appId });
};

export const detachWorkflow = async (id) => {
  return await api.post(`/workflows/${id}/detach`);
};

export const unlinkWorkflowApp = async (id) => {
  return await api.post(`/workflows/${id}/unlink-app`);
};

export const discoverDocumentSkills = async (params) => {
  return api.get('/skills/discover', { params });
};

export const triggerDocumentWorkflow = async (id, data) => {
  return api.post(`/workflows/${id}/execute`, { data });
};

export const getAllWorkflowExecutions = async (params) => {
  return api.get('/workflows/executions', { params });
};
