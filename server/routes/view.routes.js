import express from 'express';
const router = express.Router();

// External packages
import asyncHandler from 'express-async-handler';

// Internal modules
import {
  listViewsHandler,
  getViewHandler,
  createViewHandler,
  updateViewHandler,
  deleteViewHandler,
  shareViewHandler,
} from '../controllers/view.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import {
  attachOrganization,
  requireAppPermission,
  requireResourcePermission,
} from '../middleware/permission.middleware.js';
import { APP_PERMISSIONS } from '../constants/permissions.js';

// All view routes are protected
router.use(protect);
router.use(attachOrganization);

/**
 * List all views for an application
 * @route GET /api/v1/apps/:appId/views
 */
router.get('/apps/:appId/views', requireAppPermission(APP_PERMISSIONS.APP_VIEW), listViewsHandler);

/**
 * Create a new view in the given application
 * @route POST /api/v1/apps/:appId/views/create
 */
router.post(
  '/apps/:appId/views/create',
  requireAppPermission(APP_PERMISSIONS.VIEW_DESIGN),
  createViewHandler,
);

/**
 * Retrieve a single view by id
 * @route GET /api/v1/apps/:appId/views/:viewId
 */
router.get(
  '/apps/:appId/views/:viewId',
  requireResourcePermission('view', 'VIEW', { idField: 'viewId', idSource: 'params' }),
  getViewHandler,
);

/**
 * Update an existing view
 * @route POST /api/v1/apps/:appId/views/:viewId/update
 */
router.post(
  '/apps/:appId/views/:viewId/update',
  requireResourcePermission('view', 'EDIT', { idField: 'viewId', idSource: 'params' }),
  updateViewHandler,
);

/**
 * Delete a view by id
 * @route POST /api/v1/apps/:appId/views/:viewId/delete
 */
router.post(
  '/apps/:appId/views/:viewId/delete',
  requireResourcePermission('view', 'EDIT', { idField: 'viewId', idSource: 'params' }),
  deleteViewHandler,
);

/**
 * Share a view (update permissions)
 * @route POST /api/v1/apps/:appId/views/:viewId/share
 */
router.post(
  '/apps/:appId/views/:viewId/share',
  requireResourcePermission('view', 'EDIT', { idField: 'viewId', idSource: 'params' }),
  shareViewHandler,
);

export default router;
