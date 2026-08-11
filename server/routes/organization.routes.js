import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permission.middleware.js';
import { PERMISSIONS } from '../constants/permissions.js';
import {
  getMyOrganizations,
  switchOrganization,
  getOrganizationMembers,
  getOrganizationRoles,
  updateOrganization,
  createOrganization,
  getOrgQuota,
  generateOrgInvitation,
  getOrgInvitations,
  revokeOrgInvitation,
  transferOwnership,
  joinOrganization,
} from '../controllers/organization.controller.js';

const router = express.Router();

// Get user's organizations (no org context needed)
router.get('/', protect, getMyOrganizations);

// Create a new organization
router.post('/', protect, createOrganization);

// Join an organization using invitation code
router.post('/join', protect, joinOrganization);

// Switch to a different organization (no org context needed)
router.post('/:id/switch', protect, switchOrganization);

// Get organization members (requires permission)
router.get('/:id/members', protect, getOrganizationMembers);

// Get organization roles
router.get('/:id/roles', protect, getOrganizationRoles);

// Update organization settings (requires permission)
router.post('/:id', protect, updateOrganization);

// Get organization quota (requires permission)
router.get('/:id/quota', protect, getOrgQuota);

// Generate org invitation (requires permission)
router.post('/:id/invitations', protect, generateOrgInvitation);

// Get org invitations
router.get('/:id/invitations', protect, getOrgInvitations);

// Revoke org invitation
router.delete('/:id/invitations/:invitationId', protect, revokeOrgInvitation);

// Transfer ownership (Requires being the current owner)
router.post('/:id/transfer-ownership', protect, transferOwnership);

export default router;
