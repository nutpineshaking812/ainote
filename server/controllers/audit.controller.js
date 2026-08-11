import asyncHandler from 'express-async-handler';
import { sendSuccess } from '../utils/response.js';
import permissionEngine from '../services/permissionEngine.service.js';

/**
 * @desc    Audit: Get permissions for a specific user
 * @route   GET /api/v1/audit/user/:id
 * @access  Private (Org Manager required)
 */
export const getUserAudit = asyncHandler(async (req, res) => {
  const { id: userId } = req.params;
  const organizationId = req.headers['x-organization-id'];

  const audit = await permissionEngine.getUserAudit(userId, organizationId);
  sendSuccess(res, audit);
});

/**
 * @desc    Audit: Get all entities with access to a resource
 * @route   GET /api/v1/audit/resource/:id
 * @access  Private (Org Manager required)
 */
export const getResourceAudit = asyncHandler(async (req, res) => {
  const { id: resourceId } = req.params;
  const organizationId = req.headers['x-organization-id'];

  const audit = await permissionEngine.getResourceAudit(resourceId, organizationId);
  sendSuccess(res, audit);
});

export default {
  getUserAudit,
  getResourceAudit,
};
