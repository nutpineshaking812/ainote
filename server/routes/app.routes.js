import express from 'express';
const router = express.Router();
import {
  getApplications,
  getApplication,
  createApplication,
  updateApplication,
  deleteApplication,
  getApiKeys,
  createApiKey,
  revokeApiKey,
} from '../controllers/app.controller.js';
import {
  getAppPermissions,
  addAppPermission,
  removeAppPermission,
  updateAppPermission,
  getMyAppPermissions,
} from '../controllers/appPermission.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { attachOrganization, requirePermission } from '../middleware/permission.middleware.js';
import { PERMISSIONS } from '../constants/permissions.js';

// Read operations - 需要登录和组织成员身份
router.route('/').get(protect, attachOrganization, getApplications);
router.route('/:id').get(protect, attachOrganization, getApplication);

// Write operations - 需要特定权限
router
  .route('/create')
  .post(protect, attachOrganization, requirePermission(PERMISSIONS.APP_CREATE), createApplication);
router.route('/update').post(protect, attachOrganization, updateApplication);
router
  .route('/delete')
  .post(protect, attachOrganization, requirePermission(PERMISSIONS.APP_DELETE), deleteApplication);

// App permission routes - 需要登录
router.route('/:appId/permissions').get(protect, getAppPermissions);
router.route('/:appId/permissions').post(protect, addAppPermission);
router.route('/:appId/permissions/:permissionId').delete(protect, removeAppPermission);
router.route('/:appId/permissions/:permissionId').put(protect, updateAppPermission);
router.route('/:appId/my-permissions').get(protect, getMyAppPermissions);

// API key management routes - 需要登录
router.route('/:id/apikeys').get(protect, attachOrganization, getApiKeys);
router.route('/:id/apikeys').post(protect, attachOrganization, createApiKey);
router.route('/:id/apikeys/:keyId').delete(protect, attachOrganization, revokeApiKey);

export default router;
