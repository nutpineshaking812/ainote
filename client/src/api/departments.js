import api from './index';

/**
 * Get all departments for an organization
 * @param {string} organizationId
 * @returns {Promise<Object>} { departments }
 */
export const getOrganizationDepartments = async (organizationId) => {
  if (!organizationId) throw new Error('organizationId required');
  const response = await api.get(`/organizations/${organizationId}/departments`);
  return response;
};

/**
 * Create a new department
 * @param {string} organizationId
 * @param {Object} data { name, description, parentId }
 * @returns {Promise<Object>} { department }
 */
export const createDepartment = async (organizationId, data) => {
  if (!organizationId) throw new Error('organizationId required');
  return api.post(`/organizations/${organizationId}/departments`, data);
};

/**
 * Update an existing department
 * @param {string} departmentId
 * @param {Object} data { name, description }
 * @returns {Promise<Object>} { department }
 */
export const updateDepartment = async (departmentId, data) => {
  if (!departmentId) throw new Error('departmentId required');
  return api.post(`/departments/${departmentId}`, data);
};

/**
 * Delete a department
 * @param {string} departmentId
 * @returns {Promise<Object>}
 */
export const deleteDepartment = async (departmentId) => {
  if (!departmentId) throw new Error('departmentId required');
  return api.post(`/departments/${departmentId}/delete`);
};
