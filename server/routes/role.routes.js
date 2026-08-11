import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  getRoles,
  getGlobalRoles,
  getTemplateRoles,
  getAppRoles,
  createRole,
  updateRole,
  deleteRole,
  getPermissions,
} from '../controllers/role.controller.js';

const router = express.Router();

// Get roles for an organization (generic/legacy)
router.get('/', protect, getRoles);

// Get specialized roles
router.get('/global', protect, getGlobalRoles);
router.get('/templates', protect, getTemplateRoles);
router.get('/app/:appId', protect, getAppRoles);

// Create a new role
router.post('/create', protect, createRole);

// Update a role
router.post('/:id', protect, updateRole);

// Delete a role
router.post('/:id/delete', protect, deleteRole);

// Get available permissions
router.get('/permissions/list', protect, getPermissions);

export default router;
