import formService from '../services/form.service.js';
import asyncHandler from 'express-async-handler';
import { sendSuccess } from '../utils/response.js';

/**
 * @desc    Create a new form
 * @route   POST /api/v1/apps/:appId/forms/create
 * @access  Private
 */
export const createForm = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const form = await formService.createForm({ ...req.body, appId }, req.user.id);
  sendSuccess(res, form, 201);
});

/**
 * @desc    Get all forms for an application
 * @route   GET /api/v1/apps/:appId/forms
 * @access  Private
 */
export const getForms = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const forms = await formService.getForms(appId, req.user.id);
  sendSuccess(res, forms);
});

/**
 * @desc    Get a single form
 * @route   GET /api/v1/apps/:appId/forms/:formId
 * @access  Private
 */
export const getForm = asyncHandler(async (req, res) => {
  const { formId } = req.params;
  const form = await formService.getFormById(formId, req.user.id);
  sendSuccess(res, form);
});

/**
 * @desc    Update a form
 * @route   POST /api/v1/apps/:appId/forms/:formId/update
 * @access  Private
 */
export const updateForm = asyncHandler(async (req, res) => {
  const { formId } = req.params;
  const form = await formService.updateForm(formId, req.body, req.user.id);
  sendSuccess(res, form);
});

/**
 * @desc    Delete a form
 * @route   POST /api/v1/apps/:appId/forms/:formId/delete
 * @access  Private
 */
export const deleteForm = asyncHandler(async (req, res) => {
  const { formId } = req.params;
  await formService.deleteForm(formId, req.user.id);
  sendSuccess(res, { message: 'Form deleted successfully' });
});

/**
 * @desc    Share a form
 * @route   POST /api/v1/apps/:appId/forms/:formId/share
 * @access  Private
 */
export const shareForm = asyncHandler(async (req, res) => {
  const { formId } = req.params;
  const { shares } = req.body;
  const form = await formService.shareForm(formId, shares, req.user.id);
  sendSuccess(res, form);
});
