import api from './index';

const cleanParams = (obj = {}) => {
  const entries = Object.entries(obj).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
  return Object.fromEntries(entries);
};

// Create document
export const createDocument = async (payload, { appId, formId, recordId } = {}) => {
  if (!appId) throw new Error('appId required');
  const documentPayload = {
    ...payload,
  };
  Object.assign(documentPayload, cleanParams({ formId, recordId }));
  return api.post(`/documents/apps/${appId}/documents/create`, documentPayload);
};

// Single document
export const getDocument = async (appId, docId) => {
  if (!appId) throw new Error('appId required');
  return api.get(`/documents/apps/${appId}/documents/${docId}`);
};

export const getDocumentWithChildren = async (appId, docId) => {
  if (!appId || !docId) throw new Error('appId and docId required');
  return api.get(`/documents/apps/${appId}/documents/${docId}/with-children`);
};

export const getDocumentPath = async (appId, docId) => {
  if (!appId || !docId) throw new Error('appId and docId required');
  return api.get(`/documents/apps/${appId}/documents/${docId}/path`);
};

// Actions
export const updateDocument = async (appId, docId, payload) => {
  if (!appId) throw new Error('appId required');
  return api.post(`/documents/apps/${appId}/documents/${docId}/update`, payload);
};

export const deleteDocument = async (appId, docId) => {
  if (!appId || !docId) throw new Error('appId and docId required');
  return api.post(`/documents/apps/${appId}/documents/${docId}/delete`);
};

export const shareDocument = async (appId, docId, shares) => {
  if (!appId || !docId) throw new Error('appId and docId required');
  return api.post(`/documents/apps/${appId}/documents/${docId}/share`, { shares });
};

// Listing
export const listDocuments = async (appId, params = {}) => {
  if (!appId) throw new Error('appId required');
  const safeParams = cleanParams(params);
  return api.get(`/documents/apps/${appId}/documents/list`, { params: safeParams });
};

// Recent (Keep as is since it doesn't strictly need appId in route for current design, 
// but we could scent it if needed. For now, leave as global /documents/recent)
export const recentDocuments = async (params = {}, options = {}) => {
  const safeParams = cleanParams(params);
  const axiosOptions = { params: safeParams, ...options };
  return api.get(`/documents/recent`, axiosOptions);
};
