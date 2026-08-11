import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { attachOrganization, requireAppPermission } from '../middleware/permission.middleware.js';
import { APP_PERMISSIONS } from '../constants/permissions.js';
import {
  getResources,
  getResourceById,
  saveResourcesFull,
  addResource,
  removeResource,
  reorder,
  hideResource,
  pinResource,
  moveResource,
  getResourcesSync,
  updateResourceMeta,
} from '../controllers/resources.controller.js';

// Mounted at /api/v1/apps/:appId/resources
const router = express.Router({ mergeParams: true });

router.use(protect);
router.use(attachOrganization);

// Read operations - require APP_VIEW
router.get('/sync', requireAppPermission(APP_PERMISSIONS.APP_VIEW), getResourcesSync);
router.get('/', requireAppPermission(APP_PERMISSIONS.APP_VIEW), getResources);
router.get('/:resourceId', requireAppPermission(APP_PERMISSIONS.APP_VIEW), getResourceById);

// Write operations - permissions checked in service layer based on resource type
// (FORM_DESIGN for forms, VIEW_DESIGN for views, DOC_MANAGE for documents, or ownership)
router.post('/save', requireAppPermission(APP_PERMISSIONS.APP_VIEW), saveResourcesFull);
router.post('/add', requireAppPermission(APP_PERMISSIONS.APP_VIEW), addResource);
router.post('/remove', requireAppPermission(APP_PERMISSIONS.APP_VIEW), removeResource);
router.post('/reorder', requireAppPermission(APP_PERMISSIONS.APP_VIEW), reorder);
router.post('/hide', requireAppPermission(APP_PERMISSIONS.APP_VIEW), hideResource);
router.post('/pin', requireAppPermission(APP_PERMISSIONS.APP_VIEW), pinResource);
router.post('/move', requireAppPermission(APP_PERMISSIONS.APP_VIEW), moveResource);
router.post('/update-meta', requireAppPermission(APP_PERMISSIONS.APP_VIEW), updateResourceMeta);

export default router;
