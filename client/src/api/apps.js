import api from './index';

export const getApps = async () => {
  return api.get('/apps');
};

export const getApp = async (id) => {
  return api.get(`/apps/${id}`);
};

export const createApp = async (appData) => {
  return api.post('/apps/create', appData);
};

export const updateApp = async (id, appData) => {
  return api.post('/apps/update', { id, ...appData });
};

export const deleteApp = async (id) => {
  return api.post('/apps/delete', { id });
};

/**
 * Get current user's permissions for a specific app
 * @param {string} appId - Application ID
 * @returns {Promise<{permissions: string[]}>}
 */
export const getMyAppPermissions = async (appId) => {
  return api.get(`/apps/${appId}/my-permissions`);
};
