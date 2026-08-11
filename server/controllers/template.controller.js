import asyncHandler from 'express-async-handler';
import templateService from '../services/template.service.js';
import { sendSuccess } from '../utils/response.js';

/**
 * @desc    List templates for current user
 * @route   GET /api/v1/templates
 * @access  Private
 */
export const listTemplates = asyncHandler(async (req, res) => {
  const templates = await templateService.listTemplates(req.query, req.user.id);
  sendSuccess(res, templates);
});

/**
 * @desc    Get single template
 * @route   GET /api/v1/templates/:id
 * @access  Private
 */
export const getTemplate = asyncHandler(async (req, res) => {
  const template = await templateService.getTemplateById(req.params.id, req.user.id);
  sendSuccess(res, template);
});

/**
 * @desc    Create template
 * @route   POST /api/v1/templates/create
 * @access  Private
 */
export const createTemplate = asyncHandler(async (req, res) => {
  const template = await templateService.createTemplate(req.body, req.user.id);
  sendSuccess(res, template, 201);
});

/**
 * @desc    Update template
 * @route   POST /api/v1/templates/update
 * @access  Private
 */
export const updateTemplate = asyncHandler(async (req, res) => {
  const { id, ...updateData } = req.body;
  const template = await templateService.updateTemplate(id, updateData, req.user.id);
  sendSuccess(res, template);
});

/**
 * @desc    Delete template
 * @route   POST /api/v1/templates/delete
 * @access  Private
 */
export const deleteTemplate = asyncHandler(async (req, res) => {
  const { id } = req.body;
  await templateService.deleteTemplate(id, req.user.id);
  sendSuccess(res, { message: 'Template deleted successfully' });
});

export default {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
};
