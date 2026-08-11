import api from './index';

/**
 * Get global roles for an organization
 */
export const getGlobalRoles = async () => {
  return api.get('/roles/global');
};

/**
 * Get role templates for an organization
 */
export const getTemplateRoles = async () => {
  return api.get('/roles/templates');
};

/**
 * Get app-specific roles for an organization
 */
export const getAppRoles = async (appId) => {
  if (!appId) throw new Error('appId required');
  return api.get(`/roles/app/${appId}`);
};

/**
 * Get available permissions list
 * @returns {Promise<Object>} { groups, permissions }
 */
export const getAvailablePermissions = async () => {
  return api.get('/roles/permissions/list');
};

/**
 * Create a new role
 * @param {String} organizationId - Organization ID
 * @param {Object} data - Role data
 * @returns {Promise<Object>} { role }
 */
export const createRole = async (data) => {
  return api.post('/roles/create', data);
};

/**
 * Update a role
 * @param {String} roleId - Role ID
 * @param {Object} data - Role data
 * @returns {Promise<Object>} { role }
 */
export const updateRole = async (roleId, data) => {
  if (!roleId) throw new Error('roleId required');
  return api.post(`/roles/${roleId}`, data);
};

/**
 * Delete a role
 * @param {String} roleId - Role ID
 * @returns {Promise<Object>} { message }
 */
export const deleteRole = async (roleId) => {
  if (!roleId) throw new Error('roleId required');
  return api.post(`/roles/${roleId}/delete`);
};
