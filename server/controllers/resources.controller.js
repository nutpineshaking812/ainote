import asyncHandler from 'express-async-handler';
import { sendSuccess } from '../utils/response.js';
import resourceService from '../services/resource.service.js';

/**
 * GET /api/v1/apps/:appId/resources
 * Returns ordered mixed resources list for an application.
 */
export const getResources = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const { parentId } = req.query;
  const data = await resourceService.getResources(appId, req.user.id, parentId, {
    permissions: req.allPermissions,
    member: req.member,
    organizationId: req.organization?._id || req.headers['x-organization-id'],
  });
  sendSuccess(res, data);
});

/**
 * GET /api/v1/apps/:appId/resources/:resourceId
 * Get resource details by resource ID
 */
export const getResourceById = asyncHandler(async (req, res) => {
  const { resourceId } = req.params;
  const data = await resourceService.getResourceById(resourceId, req.user.id);
  sendSuccess(res, data);
});

/**
 * POST /api/v1/apps/:appId/resources/save
 * Full overwrite ordering & metadata (restricted usage).
 */
export const saveResourcesFull = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const { items } = req.body;
  const data = await resourceService.saveResources(appId, items, req.user.id);
  sendSuccess(res, data);
});

/**
 * POST /api/v1/apps/:appId/resources/add { type,id,name?,desc? }
 */
export const addResource = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const { type, refId, desc, parentId, meta } = req.body;
  const data = await resourceService.upsertResourceItem(
    appId,
    { type, refId, desc, parentId, meta },
    req.user.id,
  );
  sendSuccess(res, data);
});

/**
 * POST /api/v1/apps/:appId/resources/remove { type,id }
 */
export const removeResource = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const { type, refId } = req.body;
  const data = await resourceService.removeResourceItem(appId, type, refId, req.user.id);
  sendSuccess(res, data);
});

/**
 * POST /api/v1/apps/:appId/resources/reorder { ordered:[{type,id}...] }
 */
export const reorder = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const { ordered } = req.body;
  const data = await resourceService.reorderResources(appId, ordered, req.user.id);
  sendSuccess(res, data);
});

/**
 * POST /api/v1/apps/:appId/resources/hide { type,id,hidden:true|false }
 */
export const hideResource = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const { type, refId, hidden } = req.body;
  const data = await resourceService.setHidden(appId, type, refId, hidden, req.user.id);
  sendSuccess(res, data);
});

/**
 * POST /api/v1/apps/:appId/resources/pin { type,id,pinned:true|false }
 */
export const pinResource = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const { type, refId, pinned } = req.body;
  const data = await resourceService.setPinned(appId, type, refId, pinned, req.user.id);
  sendSuccess(res, data);
});

/**
 * POST /api/v1/apps/:appId/resources/move
 * Move a resource to a new parent or new position.
 */
export const moveResource = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const { nodeId, newParentId, newOrder } = req.body;
  const data = await resourceService.moveResource(
    appId,
    nodeId,
    newParentId,
    newOrder,
    req.user.id,
  );
  sendSuccess(res, data);
});

/**
 * Get resources for sync (cache-first mode)
 * Returns all resources for an app, optionally filtered by updatedAfter timestamp and parentId.
 * This endpoint is optimized for client-side caching and does not apply permission filtering.
 */
export const getResourcesSync = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const { updatedAfter, parentId } = req.query;
  const data = await resourceService.getResourcesSync(appId, req.user.id, updatedAfter, parentId);
  sendSuccess(res, data);
});
/**
 * POST /api/v1/apps/:appId/resources/update-meta { type, refId, meta }
 */
export const updateResourceMeta = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const { type, refId, meta } = req.body;
  const data = await resourceService.updateResourceMeta(appId, type, refId, meta, req.user.id);
  sendSuccess(res, data);
});
