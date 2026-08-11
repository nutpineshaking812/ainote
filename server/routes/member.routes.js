import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  batchCreateMembers,
  updateMemberRoles,
  batchAddMembersToDepartment,
  removeFromDepartment,
  updateMemberQuota,
} from '../controllers/member.controller.js';

const router = express.Router();

// Batch create members for an organization
router.post('/:id/members/batch', protect, batchCreateMembers);

// Update member roles and departments
router.post('/:memberId/update', protect, updateMemberRoles);

// Update member AI quota
router.put('/:memberId/quota', protect, updateMemberQuota);

// Batch add members to a department
router.post('/departments/:departmentId/members/batch', protect, batchAddMembersToDepartment);

// Remove member from a department
router.post('/:memberId/departments/:departmentId/remove', protect, removeFromDepartment);

export default router;
