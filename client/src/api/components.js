import api from './index';

// ViewComponent API helpers after decoupling (no appId/viewId stored in component itself).
// Source field indicates origin: aimessage/manual/import/system/other
export const listComponents = async (appId, params = {}) =>
  api.get(`/apps/${appId}/components`, { params });
export const createComponent = async (appId, data) =>
  api.post(`/apps/${appId}/components/create`, data); // data may include source
export const createComponentFromMessage = async (appId, messageId, segmentId) =>
  api.post(`/apps/${appId}/components/from-message`, {
    messageId,
    ...(segmentId ? { segmentId } : {}),
  });
export const getComponent = async (componentId) => api.get(`/components/${componentId}`);
export const getComponentData = async (componentId) => api.get(`/components/${componentId}/data`);
export const updateComponent = async (componentId, data) =>
  api.post('/components/update', { id: componentId, ...data });
export const deleteComponent = async (componentId) =>
  api.post('/components/delete', { id: componentId });
