import api from './index';

/**
 * Get all categories for current organization
 * @returns {Promise<Array>}
 */
export const getOrgCategories = async () => {
  return api.get('/org-categories');
};

/**
 * Create a new category
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export const createOrgCategory = async (data) => {
  return api.post('/org-categories/create', data);
};

/**
 * Update a category
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export const updateOrgCategory = async (data) => {
  return api.post('/org-categories/update', data);
};

/**
 * Delete a category
 * @param {string} id
 * @returns {Promise<void>}
 */
export const deleteOrgCategory = async (id) => {
  return api.post('/org-categories/delete', { id });
};

export default {
  getOrgCategories,
  createOrgCategory,
  updateOrgCategory,
  deleteOrgCategory,
};
