import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { attachOrganization, requireAppPermission } from '../middleware/permission.middleware.js';
import { APP_PERMISSIONS } from '../constants/permissions.js';
import {
  submitFormRecord,
  getFormRecords,
  updateFormRecord,
  getFieldDistinctValues,
  deleteFormRecord,
  createFormRecord,
  createFormRecordsBatch,
  exportFormRecordsExcel,
  exportFormTemplateExcel,
  importFormRecordsExcel,
} from '../controllers/formRecord.controller.js';
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

const router = express.Router();

// --- Public Route ---
router.post('/submit', submitFormRecord);

// --- Protected Routes ---
router.use(protect, attachOrganization);

// Basic CRUD - all use formId from query/body, except update/delete which use recordId
router.get(
  '/',
  requireAppPermission(APP_PERMISSIONS.FORM_VIEW, {
    resourceIdField: 'formId',
    resourceIdSource: 'query',
  }),
  getFormRecords,
);
router.post(
  '/create',
  requireAppPermission(APP_PERMISSIONS.FORM_FILL, {
    resourceIdField: 'formId',
    resourceIdSource: 'body',
  }),
  createFormRecord,
);
router.post(
  '/update',
  requireAppPermission(APP_PERMISSIONS.FORM_VIEW, {
    resourceIdField: 'id',
    resourceIdSource: 'body',
    resourceType: 'record',
  }),
  updateFormRecord,
);
router.post(
  '/delete',
  requireAppPermission(APP_PERMISSIONS.FORM_VIEW, {
    resourceIdField: 'id',
    resourceIdSource: 'body',
    resourceType: 'record',
  }),
  deleteFormRecord,
);

// Field-level operations
router.get(
  '/distinct-values',
  requireAppPermission(APP_PERMISSIONS.FORM_VIEW, {
    resourceIdField: 'formId',
    resourceIdSource: 'query',
  }),
  getFieldDistinctValues,
);

// Batch & Excel operations
router.post(
  '/batch',
  requireAppPermission(APP_PERMISSIONS.FORM_FILL, {
    resourceIdField: 'formId',
    resourceIdSource: 'query',
  }),
  createFormRecordsBatch,
);
router.get(
  '/export.xlsx',
  requireAppPermission(APP_PERMISSIONS.FORM_VIEW, {
    resourceIdField: 'formId',
    resourceIdSource: 'query',
  }),
  exportFormRecordsExcel,
);
router.get(
  '/template.xlsx',
  requireAppPermission(APP_PERMISSIONS.FORM_DESIGN, {
    resourceIdField: 'formId',
    resourceIdSource: 'query',
  }),
  exportFormTemplateExcel,
);
router.post(
  '/import.xlsx',
  upload.single('file'),
  requireAppPermission(APP_PERMISSIONS.FORM_FILL, {
    resourceIdField: 'formId',
    resourceIdSource: 'query',
  }),
  importFormRecordsExcel,
);

export default router;
