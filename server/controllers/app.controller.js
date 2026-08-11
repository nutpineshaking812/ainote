import appService from '../services/app.service.js';
import asyncHandler from 'express-async-handler';
import { sendSuccess } from '../utils/response.js';

/**
 * @desc    Get all applications for the current organization
 * @route   GET /api/v1/apps
 * @access  Private
 */
const getApplications = asyncHandler(async (req, res) => {
  const organizationId = req.headers['x-organization-id'];
  const applications = await appService.getApplications(organizationId, req.user.id);
  sendSuccess(res, applications);
});

/**
 * @desc    Get single application
 * @route   GET /api/v1/apps/:id
 * @access  Private
 */
const getApplication = asyncHandler(async (req, res) => {
  const organizationId = req.headers['x-organization-id'];
  const application = await appService.getApplicationById(
    req.params.id,
    organizationId,
    '-apiKeys',
  );
  sendSuccess(res, application);
});

/**
 * @desc    Create new application
 * @route   POST /api/v1/apps/create
 * @access  Private
 */
const createApplication = asyncHandler(async (req, res) => {
  const organizationId = req.headers['x-organization-id'];
  const application = await appService.createApplication(req.body, req.user.id, organizationId);
  sendSuccess(res, application, 201);
});

/**
 * @desc    Update application
 * @route   POST /api/v1/apps/update
 * @access  Private
 */
const updateApplication = asyncHandler(async (req, res) => {
  const organizationId = req.headers['x-organization-id'];
  const { id, ...updateData } = req.body;
  const application = await appService.updateApplication(id, updateData, organizationId);
  sendSuccess(res, application);
});

/**
 * @desc    Delete application
 * @route   POST /api/v1/apps/delete
 * @access  Private
 */
const deleteApplication = asyncHandler(async (req, res) => {
  const organizationId = req.headers['x-organization-id'];
  const { id } = req.body;
  await appService.deleteApplication(id, req.user.id, organizationId);
  sendSuccess(res, {});
});

/**
 * @desc    Get API keys for an application
 * @route   GET /api/v1/apps/:id/apikeys
 * @access  Private
 */
const getApiKeys = asyncHandler(async (req, res) => {
  const organizationId = req.headers['x-organization-id'];
  const keys = await appService.getApiKeys(req.params.id, organizationId);
  sendSuccess(res, keys);
});

/**
 * @desc    Create new API key for an application
 * @route   POST /api/v1/apps/:id/apikeys
 * @access  Private
 */
const createApiKey = asyncHandler(async (req, res) => {
  const organizationId = req.headers['x-organization-id'];
  const { name } = req.body;
  const result = await appService.createApiKey(req.params.id, name, organizationId);
  sendSuccess(res, result, 201);
});

/**
 * @desc    Revoke an API key
 * @route   DELETE /api/v1/apps/:id/apikeys/:keyId
 * @access  Private
 */
const revokeApiKey = asyncHandler(async (req, res) => {
  const organizationId = req.headers['x-organization-id'];
  await appService.revokeApiKey(req.params.id, req.params.keyId, organizationId);
  sendSuccess(res, {});
});

export {
  getApplications,
  getApplication,
  createApplication,
  updateApplication,
  deleteApplication,
  getApiKeys,
  createApiKey,
  revokeApiKey,
};

export default {
  getApplications,
  getApplication,
  createApplication,
  updateApplication,
  deleteApplication,
  getApiKeys,
  createApiKey,
  revokeApiKey,
};
