import api from './index';

/**
 * Get user's organizations
 * @returns {Promise<Object>} { organizations }
 */
export const getMyOrganizations = async () => {
  return api.get('/organizations');
};

/**
 * Switch to a different organization
 * @param {String} organizationId - Organization ID to switch to
 * @returns {Promise<Object>} { organization, permissions }
 */
export const switchOrganization = async (organizationId) => {
  if (!organizationId) throw new Error('organizationId required');
  return api.post(`/organizations/${organizationId}/switch`);
};

/**
 * Get organization members
 * @param {String} organizationId - Organization ID
 * @returns {Promise<Object>} { members }
 */
export const getOrganizationMembers = async (organizationId) => {
  if (!organizationId) throw new Error('organizationId required');
  return api.get(`/organizations/${organizationId}/members`);
};

/**
 * Update organization settings
 * @param {String} organizationId - Organization ID
 * @param {Object} data - Organization data to update
 * @returns {Promise<Object>} { organization }
 */
export const updateOrganization = async (organizationId, data) => {
  if (!organizationId) throw new Error('organizationId required');
  return api.post(`/organizations/${organizationId}`, data);
};

/**
 * Create a new organization
 * @param {Object} data - Organization data { name, description }
 * @returns {Promise<Object>} { organization }
 */
export const createOrganization = async (data) => {
  if (!data.name) throw new Error('Organization name is required');
  return api.post('/organizations', data);
};
/**
 * Get organization quota and balance
 * @param {String} organizationId
 */
export const getOrgQuota = async (organizationId) => {
  if (!organizationId) throw new Error('organizationId required');
  return api.get(`/organizations/${organizationId}/quota`);
};

/**
 * Generate organizational invitation code
 * @param {String} organizationId
 * @param {Object} data { maxUses, expiresAt }
 */
export const generateOrgInvitation = async (organizationId, data) => {
  if (!organizationId) throw new Error('organizationId required');
  return api.post(`/organizations/${organizationId}/invitations`, data);
};

/**
 * Get organization invitations
 * @param {String} organizationId
 * @param {Object} params { page, limit }
 */
export const getOrgInvitations = async (organizationId, params = {}) => {
  if (!organizationId) throw new Error('organizationId required');
  return api.get(`/organizations/${organizationId}/invitations`, { params });
};

/**
 * Revoke organizational invitation code
 * @param {String} organizationId
 * @param {String} invitationId
 */
export const revokeOrgInvitation = async (organizationId, invitationId) => {
  if (!organizationId || !invitationId) throw new Error('Ids required');
  return api.delete(`/organizations/${organizationId}/invitations/${invitationId}`);
};

/**
 * Transfer organization ownership
 * @param {String} organizationId
 * @param {String} newOwnerId
 */
export const transferOwnership = async (organizationId, newOwnerId) => {
  if (!organizationId || !newOwnerId) throw new Error('Ids required');
  return api.post(`/organizations/${organizationId}/transfer-ownership`, { newOwnerId });
};

/**
 * Join organization using invitation code
 * @param {String} code - Invitation code
 * @returns {Promise<Object>} { organization }
 */
export const joinOrganization = async (code) => {
  if (!code) throw new Error('Invitation code is required');
  return api.post('/organizations/join', { code });
};

