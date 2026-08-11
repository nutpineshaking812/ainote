import asyncHandler from 'express-async-handler';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import OrganizationMemberRepository from '../repositories/organizationMember.repository.js';
import DepartmentRepository from '../repositories/department.repository.js';
import QuotaRepository from '../repositories/quota.repository.js';
import * as memberService from '../services/member.service.js';
import permissionCache from '../services/permissionCache.service.js';

// @desc    Batch create members for an organization
// @route   POST /api/v1/organizations/:id/members/batch
// @access  Private (requires MEMBER_MANAGE permission)
export const batchCreateMembers = asyncHandler(async (req, res) => {
  const { id: organizationId } = req.params;
  const { members } = req.body;

  if (!members || !Array.isArray(members) || members.length === 0) {
    throw ApiError.badRequest('Members array is required', 'MEMBERS_REQUIRED');
  }

  const results = await memberService.batchCreateMembers(organizationId, members, req.user._id);

  return sendSuccess(res, {
    summary: {
      total: members.length,
      succeeded: results.success.length,
      failed: results.failed.length,
    },
    results,
  });
});

// @desc    Update member's roles and departments
// @route   POST /api/v1/members/:memberId/update
// @access  Private (requires MEMBER_MANAGE permission)
export const updateMemberRoles = asyncHandler(async (req, res) => {
  const { memberId } = req.params;
  const member = await memberService.updateMemberRoles(memberId, req.body, req.user._id);

  return sendSuccess(res, {
    member: {
      id: member.id,
      roleIds: member.roleIds,
      departmentIds: member.departmentIds,
    },
  });
});

// @desc    Batch add members to a department
// @route   POST /api/v1/departments/:departmentId/members/batch
// @access  Private (requires MEMBER_MANAGE permission)
export const batchAddMembersToDepartment = asyncHandler(async (req, res) => {
  const { departmentId } = req.params;
  const { memberIds } = req.body;

  if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
    throw ApiError.badRequest('Member IDs array is required', 'MEMBER_IDS_REQUIRED');
  }

  const department = await DepartmentRepository.findById(departmentId);
  if (!department) throw ApiError.notFound('Department not found', 'DEPT_NOT_FOUND');

  // In PostgreSQL, we can use a single update for all memberIds
  for (const memberId of memberIds) {
    const member = await OrganizationMemberRepository.findById(memberId);
    if (member) {
      const newDepts = [...new Set([...(member.departmentIds || []), departmentId])];
      await OrganizationMemberRepository.update(memberId, { departmentIds: newDepts });
      await permissionCache.invalidateMemberCache(member.userId, member.organizationId);
    }
  }

  return sendSuccess(res, {
    message: `Successfully added ${memberIds.length} members to department ${department.name}`,
  });
});

// @desc    Remove member from a department
// @route   POST /api/v1/members/:memberId/departments/:departmentId/remove
// @access  Private (requires MEMBER_MANAGE permission)
export const removeFromDepartment = asyncHandler(async (req, res) => {
  const { memberId, departmentId } = req.params;

  const member = await OrganizationMemberRepository.findById(memberId);
  if (!member) throw ApiError.notFound('Member not found', 'MEMBER_NOT_FOUND');

  const newDepts = (member.departmentIds || []).filter((id) => id.toString() !== departmentId);
  await OrganizationMemberRepository.update(memberId, { departmentIds: newDepts });
  await permissionCache.invalidateMemberCache(member.userId, member.organizationId);

  return sendSuccess(res, {
    message: 'Member removed from department successfully',
    departmentIds: newDepts,
  });
});

// @desc    Update member's AI usage limit
// @route   PUT /api/v1/members/:memberId/quota
// @access  Private (requires MEMBER_MANAGE permission)
export const updateMemberQuota = asyncHandler(async (req, res) => {
  const { memberId } = req.params;
  const { usageLimit, invitationSlots } = req.body;

  const member = await OrganizationMemberRepository.findById(memberId);
  if (!member) throw ApiError.notFound('Member not found', 'MEMBER_NOT_FOUND');

  const updateData = {};
  if (usageLimit !== undefined) updateData.usageLimit = usageLimit;
  if (invitationSlots !== undefined) updateData.invitationSlots = invitationSlots;

  const quota = await QuotaRepository.upsert('USER', member.userId, updateData);

  return sendSuccess(res, {
    quota: {
      usageLimit: quota.usageLimit,
      invitationSlots: quota.invitationSlots,
      totalTokenUsage: quota.totalTokenUsage,
    },
  });
});
