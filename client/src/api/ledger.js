import api from './index';

/**
 * Get organization consumption ledger
 * @param {string} orgId 
 * @param {Object} params { page, limit, userId, appId, model, startTime, endTime }
 */
export const getOrgLedger = async (orgId, params = {}) => {
  if (!orgId) throw new Error('orgId required');
  return api.get(`/ledger/organization/${orgId}`, { params });
};

/**
 * Get personal consumption ledger
 * @param {Object} params { page, limit }
 */
export const getMyLedger = async (params = {}) => {
  return api.get('/ledger/my', { params });
};
