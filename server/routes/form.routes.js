import express from 'express';
const router = express.Router();
import {
  createForm,
  getForms,
  getForm,
  updateForm,
  deleteForm,
  shareForm,
} from '../controllers/form.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import {
  attachOrganization,
  requireAppPermission,
  requireResourcePermission,
} from '../middleware/permission.middleware.js';
import { APP_PERMISSIONS } from '../constants/permissions.js';

// All routes in this file are protected
router.use(protect);
router.use(attachOrganization);

/**
 * List all forms for an application
 * @route GET /api/v1/apps/:appId/forms
 */
router.get('/apps/:appId/forms', requireAppPermission(APP_PERMISSIONS.APP_VIEW), getForms);

/**
 * Create a new form in the given application
 * @route POST /api/v1/apps/:appId/forms/create
 */
router.post(
  '/apps/:appId/forms/create',
  requireAppPermission(APP_PERMISSIONS.FORM_DESIGN),
  createForm,
);

/**
 * Get a single form by id
 * @route GET /api/v1/apps/:appId/forms/:formId
 */
router.get(
  '/apps/:appId/forms/:formId',
  requireResourcePermission('form', 'VIEW', { idField: 'formId', idSource: 'params' }),
  getForm,
);

/**
 * Update an existing form
 * @route POST /api/v1/apps/:appId/forms/:formId/update
 */
router.post(
  '/apps/:appId/forms/:formId/update',
  requireResourcePermission('form', 'EDIT', { idField: 'formId', idSource: 'params' }),
  updateForm,
);

/**
 * Delete a form by id
 * @route POST /api/v1/apps/:appId/forms/:formId/delete
 */
router.post(
  '/apps/:appId/forms/:formId/delete',
  requireResourcePermission('form', 'EDIT', { idField: 'formId', idSource: 'params' }),
  deleteForm,
);

/**
 * Share a form (update permissions)
 * @route POST /api/v1/apps/:appId/forms/:formId/share
 */
router.post(
  '/apps/:appId/forms/:formId/share',
  requireResourcePermission('form', 'EDIT', { idField: 'formId', idSource: 'params' }),
  shareForm,
);

export default router;
