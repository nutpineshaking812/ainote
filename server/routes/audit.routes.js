import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { attachOrganization, requirePermission } from '../middleware/permission.middleware.js';
import { getUserAudit, getResourceAudit } from '../controllers/audit.controller.js';

const router = express.Router();

// All audit routes require authentication, organization context, and ORG_MANAGE permission
router.use(protect);
router.use(attachOrganization);
router.use(requirePermission('ORG_MANAGE'));

/**
 * @route   GET /api/v1/audit/user/:id
 */
router.get('/user/:id', getUserAudit);

/**
 * @route   GET /api/v1/audit/resource/:id
 */
router.get('/resource/:id', getResourceAudit);

export default router;
