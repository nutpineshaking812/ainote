import api from './index';

/* --------------------------------------------------
 * Management: General Publish Settings
 * -------------------------------------------------- */
export const getPublishSettings = async (appId, formId) => {
  return api.get(`/apps/${appId}/forms/${formId}/publish`);
};

export const updatePublishSettings = async (appId, formId, settings) => {
  return api.post(`/apps/${appId}/forms/${formId}/publish`, settings);
};

/* --------------------------------------------------
 * Management: Fill Link Config
 * -------------------------------------------------- */
export const getFillConfig = async (appId, formId) => {
  return api.get(`/apps/${appId}/forms/${formId}/publish/fill`);
};

export const updateFillConfig = async (appId, formId, patch) => {
  return api.post(`/apps/${appId}/forms/${formId}/publish/fill/update`, patch);
};

/* --------------------------------------------------
 * Management: Record Share Global Defaults
 * -------------------------------------------------- */
export const getRecordShareConfig = async (appId, formId) => {
  return api.get(`/apps/${appId}/forms/${formId}/publish/record-config`);
};

export const updateRecordShareConfig = async (appId, formId, patch) => {
  return api.post(`/apps/${appId}/forms/${formId}/publish/record-config/update`, patch);
};

/* --------------------------------------------------
 * Management: Query Link Config
 * -------------------------------------------------- */
export const getQueryConfig = async (appId, formId) => {
  return api.get(`/apps/${appId}/forms/${formId}/publish/query`);
};

export const updateQueryConfig = async (appId, formId, patch) => {
  return api.post(`/apps/${appId}/forms/${formId}/publish/query/update`, patch);
};

/* --------------------------------------------------
 * Management: External API Config
 * -------------------------------------------------- */
export const getExternalApiConfig = async (appId, formId) => {
  return api.get(`/apps/${appId}/forms/${formId}/publish/external`);
};

export const updateExternalApiStatus = async (appId, formId, enabled) => {
  return api.post(`/apps/${appId}/forms/${formId}/publish/external/status`, { enabled });
};

export const createExternalApiToken = async (appId, formId, { name, expiresAt, permissions }) => {
  return api.post(`/apps/${appId}/forms/${formId}/publish/external/token`, {
    name,
    expiresAt,
    permissions,
  });
};

export const deleteExternalApiToken = async (appId, formId, tokenId) => {
  return api.delete(`/apps/${appId}/forms/${formId}/publish/external/token/${tokenId}`);
};

export const updateExternalApiToken = async (
  appId,
  formId,
  tokenId,
  { name, permissions, expiresAt },
) => {
  return api.post(`/apps/${appId}/forms/${formId}/publish/external/token/${tokenId}/update`, {
    name,
    permissions,
    expiresAt,
  });
};

/* --------------------------------------------------
 * Management: Per-Record Share Operations
 * -------------------------------------------------- */
export const listRecordShares = async (appId, formId, { page = 1, limit = 10, status } = {}) => {
  const params = { page, limit, status };
  return api.get(`/apps/${appId}/forms/${formId}/record-share`, { params });
};

export const shareRecord = async (appId, formId, recordId, body = {}) => {
  return api.post(`/apps/${appId}/forms/${formId}/record-share/${recordId}/share`, body);
};

export const rotateShareCode = async (appId, formId, recordId) => {
  return api.post(`/apps/${appId}/forms/${formId}/record-share/${recordId}/rotate-code`);
};

export const revokeShare = async (appId, formId, recordId) => {
  return api.post(`/apps/${appId}/forms/${formId}/record-share/${recordId}/revoke`);
};

export const extendShareExpiry = async (appId, formId, recordId, additionalHours = 24) => {
  return api.post(`/apps/${appId}/forms/${formId}/record-share/${recordId}/extend-expiry`, {
    additionalHours,
  });
};

/* --------------------------------------------------
 * Public: Form Structure (fill/query/record)
 * -------------------------------------------------- */
export const publicGetForm = async (formId, { mode = 'fill', accessCode } = {}) => {
  const params = { mode, accessCode };
  return api.get(`/public/forms/${formId}`, { params });
};

/* --------------------------------------------------
 * Public: Submit (fill)
 * -------------------------------------------------- */
export const publicSubmitForm = async (formId, { data: payload, accessCode } = {}) => {
  const body = { data: payload || {} };
  if (accessCode) body.accessCode = accessCode;
  return api.post(`/public/forms/${formId}/submit`, body);
};

/* --------------------------------------------------
 * Public: Query Records (query link)
 * -------------------------------------------------- */
export const publicQueryRecords = async (formId, { page = 1, limit = 10, q, accessCode } = {}) => {
  const params = { page, limit, q, accessCode };
  return api.get(`/public/forms/${formId}/records`, { params });
};

/* --------------------------------------------------
 * Public: Get Shared Single Record
 * -------------------------------------------------- */
export const publicGetSharedRecord = async (formId, recordId, { accessCode } = {}) => {
  const params = { accessCode };
  return api.get(`/public/forms/${formId}/records/${recordId}`, { params });
};

/* --------------------------------------------------
 * Public: Update Shared Record (editable fields)
 * -------------------------------------------------- */
export const publicUpdateSharedRecord = async (
  formId,
  recordId,
  { updates = {}, accessCode } = {},
) => {
  const body = { data: updates };
  if (accessCode) body.accessCode = accessCode;
  return api.post(`/public/forms/${formId}/records/${recordId}/update`, body);
};
