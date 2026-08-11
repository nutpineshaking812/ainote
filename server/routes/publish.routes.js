import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { attachOrganization, requireAppPermission } from '../middleware/permission.middleware.js';
import { APP_PERMISSIONS } from '../constants/permissions.js';
import {
  getFillConfig,
  updateFillConfig,
  getRecordShareConfig,
  updateRecordShareConfig,
  getQueryConfig,
  updateQueryConfig,
  getExternalApiConfig,
  updateExternalApiStatus,
  createExternalApiToken,
  updateExternalApiToken,
  deleteExternalApiToken,
} from '../controllers/publish.controller.js';
import {
  listRecordShares,
  shareRecord,
  rotateShareCode,
  revokeShare,
  extendShareExpiry,
} from '../controllers/recordShare.controller.js';

const router = express.Router({ mergeParams: true });

// Fill config
router.get('/:formId/publish/fill', protect, attachOrganization, requireAppPermission(APP_PERMISSIONS.FORM_PUBLISH), getFillConfig);
router.post('/:formId/publish/fill/update', protect, attachOrganization, requireAppPermission(APP_PERMISSIONS.FORM_PUBLISH), updateFillConfig);

// Record share global config
router.get('/:formId/publish/record-config', protect, attachOrganization, requireAppPermission(APP_PERMISSIONS.FORM_PUBLISH), getRecordShareConfig);
router.post('/:formId/publish/record-config/update', protect, attachOrganization, requireAppPermission(APP_PERMISSIONS.FORM_PUBLISH), updateRecordShareConfig);

// Query config
router.get('/:formId/publish/query', protect, attachOrganization, requireAppPermission(APP_PERMISSIONS.FORM_PUBLISH), getQueryConfig);
router.post('/:formId/publish/query/update', protect, attachOrganization, requireAppPermission(APP_PERMISSIONS.FORM_PUBLISH), updateQueryConfig);

// External API Config
router.get('/:formId/publish/external', protect, attachOrganization, requireAppPermission(APP_PERMISSIONS.FORM_PUBLISH), getExternalApiConfig);
router.post('/:formId/publish/external/status', protect, attachOrganization, requireAppPermission(APP_PERMISSIONS.FORM_PUBLISH), updateExternalApiStatus);
router.post('/:formId/publish/external/token', protect, attachOrganization, requireAppPermission(APP_PERMISSIONS.FORM_PUBLISH), createExternalApiToken);
router.post('/:formId/publish/external/token/:tokenId/update', protect, attachOrganization, requireAppPermission(APP_PERMISSIONS.FORM_PUBLISH), updateExternalApiToken);
router.delete('/:formId/publish/external/token/:tokenId', protect, attachOrganization, requireAppPermission(APP_PERMISSIONS.FORM_PUBLISH), deleteExternalApiToken);

// Per-record share management
router.get('/:formId/record-share', protect, attachOrganization, requireAppPermission(APP_PERMISSIONS.FORM_PUBLISH), listRecordShares); // list shares for form
router.post('/:formId/record-share/:recordId/share', protect, attachOrganization, requireAppPermission(APP_PERMISSIONS.FORM_PUBLISH), shareRecord);
router.post('/:formId/record-share/:recordId/rotate-code', protect, attachOrganization, requireAppPermission(APP_PERMISSIONS.FORM_PUBLISH), rotateShareCode);
router.post('/:formId/record-share/:recordId/revoke', protect, attachOrganization, requireAppPermission(APP_PERMISSIONS.FORM_PUBLISH), revokeShare);
router.post('/:formId/record-share/:recordId/extend-expiry', protect, attachOrganization, requireAppPermission(APP_PERMISSIONS.FORM_PUBLISH), extendShareExpiry);

export default router;
