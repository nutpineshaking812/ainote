import api from './index';

/**
 * Update member details (roles, departments)
 * @param {string} memberId
 * @param {Object} data { roleIds, departmentIds, nickname }
 * @returns {Promise<Object>} { member }
 */
export const updateMember = async (memberId, data) => {
  if (!memberId) throw new Error('memberId required');
  return api.post(`/members/${memberId}/update`, data);
};

/**
 * Remove a member from a specific department
 * @param {string} memberId
 * @param {string} departmentId
 * @returns {Promise<Object>}
 */
export const removeMemberFromDepartment = async (memberId, departmentId) => {
  if (!memberId || !departmentId) throw new Error('memberId and departmentId required');
  return api.post(`/members/${memberId}/departments/${departmentId}/remove`);
};

/**
 * Batch create members for an organization
 * @param {string} organizationId
 * @param {Array} members Array of member objects
 * @returns {Promise<Object>} { summary, results }
 */
export const batchCreateMembers = async (organizationId, members) => {
  if (!organizationId) throw new Error('organizationId required');
  return api.post(`/organizations/${organizationId}/members/batch`, { members });
};

/**
 * Batch add members to a department
 * @param {string} departmentId
 * @param {Array} memberIds Array of member IDs
 * @returns {Promise<Object>}
 */
export const batchAddMembersToDepartment = async (departmentId, memberIds) => {
  if (!departmentId) throw new Error('departmentId required');
  return api.post(`/members/departments/${departmentId}/members/batch`, { memberIds });
};
/**
 * Update member's AI usage limit
 * @param {string} memberId 
 * @param {Object} data { usageLimit }
 */
export const updateMemberQuota = async (memberId, data) => {
  if (!memberId) throw new Error('memberId required');
  return api.put(`/members/${memberId}/quota`, data);
};
