// External packages
import asyncHandler from 'express-async-handler';

import ApiError from '../utils/ApiError.js';
// Data execution moved to service layer; controller no longer directly aggregates
import { sendSuccess } from '../utils/response.js';
import {
  createComponent,
  getComponent,
  listComponents,
  updateComponent,
  deleteComponent,
  createComponentFromMessage,
  runComponentData,
} from '../services/viewComponent.service.js';

/**
 * List components filtered by optional type/search/viewId.
 * @route GET /api/v1/apps/:appId/components
 */
export const doListComponents = asyncHandler(async (req, res) => {
  const items = await listComponents(req.params.appId, {
    type: req.query.type,
    search: req.query.search,
    viewId: req.query.viewId,
  });
  sendSuccess(res, { items });
});

/**
 * Create a new component (manual definition or other source).
 * @route POST /api/v1/apps/:appId/components/create
 */
export const doCreateComponent = asyncHandler(async (req, res) => {
  const doc = await createComponent(req.params.appId, req.user.id, req.body);
  sendSuccess(res, doc, 201);
});

/**
 * Get single component by id.
 * @route GET /api/v1/components/:componentId
 */
export const doGetComponent = asyncHandler(async (req, res) => {
  const doc = await getComponent(req.params.componentId);
  sendSuccess(res, doc);
});

/**
 * Execute component pipeline (normalized) and return rows + title + chartType.
 * @route GET /api/v1/components/:componentId/data
 */
export const getComponentData = asyncHandler(async (req, res) => {
  const result = await runComponentData(req.params.componentId);
  sendSuccess(res, result);
});

/**
 * Update component fields (name/description/config/pipeline...).
 * @route POST /api/v1/components/update
 */
export const doUpdateComponent = asyncHandler(async (req, res) => {
  const { id, ...updates } = req.body;
  if (!id) throw ApiError.badRequest('缺少组件ID');
  const doc = await updateComponent(id, updates);
  sendSuccess(res, doc);
});

/**
 * Delete component if not referenced by any view layout.
 * @route POST /api/v1/components/delete
 */
export const doDeleteComponent = asyncHandler(async (req, res) => {
  const { id } = req.body;
  if (!id) throw ApiError.badRequest('缺少组件ID');
  const result = await deleteComponent(id);
  sendSuccess(res, result);
});

/**
 * Create component from AI message (chart definition).
 * @route POST /api/v1/apps/:appId/components/from-message
 */
export const doCreateComponentFromMessage = asyncHandler(async (req, res) => {
  const { messageId, segmentId } = req.body;
  if (!messageId) throw ApiError.badRequest('缺少消息ID');
  const result = await createComponentFromMessage(messageId, req.user.id, { segmentId });
  sendSuccess(res, { component: result.component, alreadyExists: result.alreadyExists });
});

export default {
  doListComponents,
  doCreateComponent,
  doGetComponent,
  doUpdateComponent,
  doDeleteComponent,
  doCreateComponentFromMessage,
  getComponentData,
};
