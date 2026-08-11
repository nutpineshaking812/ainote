import express from 'express';
const router = express.Router();

// Internal modules
import {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  listDocuments,
  recentDocuments,
  getDocumentWithChildren,
  getDocumentPath,
  shareDocument,
} from '../controllers/document.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import {
  attachOrganization,
  requireAppPermission,
  requireResourcePermission,
} from '../middleware/permission.middleware.js';
import { APP_PERMISSIONS } from '../constants/permissions.js';

router.use(protect);

// recent documents (global, no app-specific permission needed)
router.get('/recent', attachOrganization, recentDocuments);

// App-scoped routes - all require at least APP_VIEW
router.use('/apps/:appId/documents', attachOrganization);

// Create document - requires APP_VIEW (users can create their own docs)
router.post(
  '/apps/:appId/documents/create',
  requireAppPermission(APP_PERMISSIONS.APP_VIEW),
  createDocument,
);

// List and read operations - requires APP_VIEW
router.get(
  '/apps/:appId/documents/list',
  requireAppPermission(APP_PERMISSIONS.APP_VIEW),
  listDocuments,
);
router.get(
  '/apps/:appId/documents/:docId',
  requireResourcePermission('document', 'VIEW', { idField: 'docId', idSource: 'params' }),
  getDocument,
);
router.get(
  '/apps/:appId/documents/:docId/with-children',
  requireResourcePermission('document', 'VIEW', { idField: 'docId', idSource: 'params' }),
  getDocumentWithChildren,
);
router.get(
  '/apps/:appId/documents/:docId/path',
  requireAppPermission(APP_PERMISSIONS.APP_VIEW),
  getDocumentPath,
);

// Update and delete - owner or DOC_MANAGE permission
router.post(
  '/apps/:appId/documents/:docId/update',
  requireResourcePermission('document', 'EDIT', { idField: 'docId', idSource: 'params' }),
  updateDocument,
);
router.post(
  '/apps/:appId/documents/:docId/delete',
  requireResourcePermission('document', 'EDIT', { idField: 'docId', idSource: 'params' }),
  deleteDocument,
);

// Share - owner only (handled in middleware via requireResourceOwner or resource permission)
router.post(
  '/apps/:appId/documents/:docId/share',
  requireResourcePermission('document', 'EDIT', { idField: 'docId', idSource: 'params' }),
  shareDocument,
);

export default router;
