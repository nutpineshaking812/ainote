// External packages
import asyncHandler from 'express-async-handler';

// Internal modules
import {
  createView,
  getView,
  updateView,
  deleteView,
  listViews,
  shareView,
} from '../services/view.service.js';
import ApiError from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';

/**
 * List all views for an application (sorted newest first).
 * @route GET /api/v1/apps/:appId/views
 */
export const listViewsHandler = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const userId = req.user._id;
  // Use service to filter by permissions
  const docs = await listViews(appId, userId);
  sendSuccess(res, docs);
});

/**
 * Retrieve a single view by id.
 * @route GET /api/v1/apps/:appId/views/:viewId
 */
export const getViewHandler = asyncHandler(async (req, res) => {
  const { viewId } = req.params;
  const userId = req.user._id;
  const doc = await getView(viewId, userId);
  sendSuccess(res, doc);
});

/**
 * Create a new view in the given application.
 * Ownership is validated inside service layer.
 * @route POST /api/v1/apps/:appId/views/create
 */
export const createViewHandler = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const ownerId = req.user._id;
  const doc = await createView(appId, ownerId, req.body);
  sendSuccess(res, doc, 201);
});

/**
 * Update an existing view (name / description / layout).
 * @route POST /api/v1/apps/:appId/views/:viewId/update
 */
export const updateViewHandler = asyncHandler(async (req, res) => {
  const { viewId } = req.params;
  const userId = req.user._id;
  const doc = await updateView({ ...req.body, id: viewId }, userId);
  sendSuccess(res, doc);
});

/**
 * Delete a view by id.
 * @route POST /api/v1/apps/:appId/views/:viewId/delete
 */
export const deleteViewHandler = asyncHandler(async (req, res) => {
  const { viewId } = req.params;
  const userId = req.user._id;
  const result = await deleteView(viewId, userId);
  sendSuccess(res, result);
});

/**
 * Share a view (update permissions).
 * @route POST /api/v1/apps/:appId/views/:viewId/share
 */
export const shareViewHandler = asyncHandler(async (req, res) => {
  const { viewId } = req.params;
  const { shares } = req.body;
  const userId = req.user._id;
  const doc = await shareView(viewId, shares, userId);
  sendSuccess(res, doc);
});
