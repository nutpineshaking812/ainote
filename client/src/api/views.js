// Placeholder view API module. Backend endpoints must be implemented to make these functional.
// View API aligned with forms.js style.
// Assumes backend implements analogous endpoints.
// Endpoints pattern chosen to mirror existing forms: create/update/delete use POST with action paths.
import api from './index';

// Create a view within an app (server route pattern: /apps/:appId/views/create)
export const createView = async (appId, viewData) => {
  return api.post(`/apps/${appId}/views/create`, { ...viewData });
};

// List views by appId (server route pattern: /apps/:appId/views)
export const getViewsByAppId = async (appId) => {
  return api.get(`/apps/${appId}/views`);
};

// Get single view
export const getView = async (appId, viewId) => {
  return api.get(`/apps/${appId}/views/${viewId}`);
};

// Update a view
export const updateView = async (appId, viewId, viewData) => {
  return api.post(`/apps/${appId}/views/${viewId}/update`, viewData);
};

// Delete a view
export const deleteView = async (appId, viewId) => {
  return api.post(`/apps/${appId}/views/${viewId}/delete`);
};

export const shareView = async (appId, viewId, shares) => {
  return api.post(`/apps/${appId}/views/${viewId}/share`, { shares });
};
