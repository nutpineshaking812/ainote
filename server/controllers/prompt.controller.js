import asyncHandler from 'express-async-handler';
import templateService from '../services/template.service.js';
import { sendSuccess } from '../utils/response.js';

/**
 * @desc    List AI prompts
 * @route   GET /api/v1/prompts
 * @access  Private
 */
export const listPrompts = asyncHandler(async (req, res) => {
  const { appId } = req.query;
  // Support both 'prompt' and 'ai-prompt' for discovery
  const query = { ...req.query, appId, type: { $in: ['prompt', 'ai-prompt'] } };
  const templates = await templateService.listTemplates(query, req.user.id);
  sendSuccess(res, templates);
});

/**
 * @desc    Get AI prompts dashboard (balanced personal/app items)
 * @route   GET /api/v1/prompts/dashboard
 * @access  Private
 */
export const getPromptDashboard = asyncHandler(async (req, res) => {
  const { appId } = req.query;
  const commonParams = {
    type: { $in: ['prompt', 'ai-prompt'] },
    fields: 'name description contentPlain scope updatedAt appId',
  };

  console.log('appId====>', appId, req.user.id);
  const [personal, app] = await Promise.all([
    templateService.listTemplates(
      {
        ...commonParams,
        scope: 'personal',
        limit: 6,
      },
      req.user.id,
    ),
    appId
      ? templateService.listTemplates(
          {
            ...commonParams,
            scope: 'app',
            appId,
            limit: 3,
          },
          req.user.id,
        )
      : Promise.resolve({ items: [], pagination: { total: 0 } }),
  ]);

  sendSuccess(res, {
    personal: {
      items: personal.items || personal,
      total: personal.pagination?.total ?? (Array.isArray(personal) ? personal.length : 0),
    },
    app: {
      items: app.items || app,
      total: app.pagination?.total ?? (Array.isArray(app) ? app.length : 0),
    },
  });
});

/**
 * @desc    Get single AI prompt
 * @route   GET /api/v1/prompts/:id
 * @access  Private
 */
export const getPrompt = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const template = await templateService.getTemplateById(id, req.user.id);
  sendSuccess(res, template);
});

/**
 * @desc    Create AI prompt
 * @route   POST /api/v1/prompts/create
 * @access  Private
 */
export const createPrompt = asyncHandler(async (req, res) => {
  const { appId } = req.body;
  const payload = { ...req.body, appId, type: 'prompt' };
  const template = await templateService.createTemplate(payload, req.user.id);
  sendSuccess(res, template, 201);
});

/**
 * @desc    Update AI prompt
 * @route   POST /api/v1/prompts/update
 * @access  Private
 */
export const updatePrompt = asyncHandler(async (req, res) => {
  const { id, appId, ...updateData } = req.body;
  const payload = { ...updateData, appId, type: 'prompt' };
  const template = await templateService.updateTemplate(id, payload, req.user.id);
  sendSuccess(res, template);
});

/**
 * @desc    Delete AI prompt
 * @route   POST /api/v1/prompts/delete
 * @access  Private
 */
export const deletePrompt = asyncHandler(async (req, res) => {
  const { id } = req.body;
  await templateService.deleteTemplate(id, req.user.id);
  sendSuccess(res, { message: 'Prompt deleted successfully' });
});

export default {
  listPrompts,
  getPromptDashboard,
  getPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
};
