import api from './index.js';

/**
 * Get permission audit for a user
 * @param {string} userId
 * @returns {Promise<Array>} List of permissions
 */
export const getUserAudit = async (userId) => {
  return api.get(`/audit/user/${userId}`);
};

/**
 * Get permission audit for a resource
 * @param {string} resourceId
 * @returns {Promise<Array>} List of assignments
 */
export const getResourceAudit = async (resourceId) => {
  return api.get(`/audit/resource/${resourceId}`);
};

export default {
  getUserAudit,
  getResourceAudit,
};
