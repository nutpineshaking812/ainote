import api from './index';

// Fetch ordered mixed resources list
export const getResources = async (appId, params = {}) => {
  const { parentId } = params;
  const queryString = parentId ? `?parentId=${parentId}` : '';
  const res = await api.get(`/apps/${appId}/resources${queryString}`);
  return res.items || res.data?.items || res; // backend sendSuccess wraps {success,data}
};

// Add (append or update) one resource item
export const addResource = async (appId, payload) => {
  const res = await api.post(`/apps/${appId}/resources/add`, payload);
  return res.items || res.data?.items || res;
};

// Remove resource item
export const removeResource = async (appId, { type, refId }) => {
  const res = await api.post(`/apps/${appId}/resources/remove`, { type, refId });
  return res.items || res.data?.items || res;
};

// Reorder resources (ordered: [{type,id}])
export const reorderResources = async (appId, ordered) => {
  const res = await api.post(`/apps/${appId}/resources/reorder`, { ordered });
  return res.items || res.data?.items || res;
};

// Hide/unhide resource
export const hideResource = async (appId, { type, refId, hidden }) => {
  const res = await api.post(`/apps/${appId}/resources/hide`, { type, refId, hidden });
  return res.items || res.data?.items || res;
};

// Pin/unpin resource
export const pinResource = async (appId, { type, refId, pinned }) => {
  const res = await api.post(`/apps/${appId}/resources/pin`, { type, refId, pinned });
  return res.items || res.data?.items || res;
};

// Full overwrite (restricted)
export const saveResourcesFull = async (appId, items) => {
  const res = await api.post(`/apps/${appId}/resources/save`, { items });
  return res.items || res.data?.items || res;
};

// Move a resource (support tree dragging)
export const moveResource = async (appId, nodeId, newParentId, newOrder) => {
  const response = await api.post(`/apps/${appId}/resources/move`, {
    nodeId,
    newParentId,
    newOrder,
  });
  return response.data;
};

// Update metadata
export const updateResourceMeta = async (appId, { type, refId, meta }) => {
  const response = await api.post(`/apps/${appId}/resources/update-meta`, {
    type,
    refId,
    meta,
  });
  return response.data;
};

export default {
  getResources,
  addResource,
  removeResource,
  reorderResources,
  hideResource,
  pinResource,
  saveResourcesFull,
  moveResource,
  updateResourceMeta,
};
