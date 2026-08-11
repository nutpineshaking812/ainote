import api from './index';

// Create a form within an app
export const createForm = async (appId, formData) => {
  return api.post(`/apps/${appId}/forms/create`, { ...formData });
};

// List forms by appId
export const getFormsByAppId = async (appId) => {
  return api.get(`/apps/${appId}/forms`);
};

// Get single form
export const getForm = async (appId, formId) => {
  return api.get(`/apps/${appId}/forms/${formId}`);
};

// Update a form
export const updateForm = async (appId, formId, formData) => {
  return api.post(`/apps/${appId}/forms/${formId}/update`, formData);
};

// Delete a form
export const deleteForm = async (appId, formId) => {
  return api.post(`/apps/${appId}/forms/${formId}/delete`);
};

// Share a form
export const shareForm = async (appId, formId, shares) => {
  return api.post(`/apps/${appId}/forms/${formId}/share`, { shares });
};
