import OrganizationMemberRepository from '../repositories/organizationMember.repository.js';
import RoleRepository from '../repositories/role.repository.js';
import PermissionAssignmentRepository from '../repositories/permissionAssignment.repository.js';
import permissionCache from './permissionCache.service.js';
import UserRepository from '../repositories/user.repository.js';
import { db } from '../db/index.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Sync a member's roles with PermissionAssignment records.
 */
export const syncMemberAssignments = async (
  userId,
  organizationId,
  roleIds,
  actorId,
  options = {},
) => {
  await PermissionAssignmentRepository.deleteMany({
    organizationId,
    principalId: userId,
    scope: ['GLOBAL', 'APP'],
  });

  if (!roleIds || roleIds.length === 0) {
    await permissionCache.invalidateMemberCache(userId, organizationId);
    return;
  }

  const roles = await RoleRepository.findByIds(roleIds);

  const assignments = roles
    .filter(role => role.scope !== 'TEMPLATE')
    .map((role) => ({
      organizationId,
      principalType: 'USER',
      principalId: userId,
      roleId: role.id,
      scope: role.scope || 'GLOBAL',
      resourceId: role.scope === 'APP' ? role.appId : organizationId,
      createdBy: actorId.toString(),
    }));

  if (assignments.length > 0) {
    for (const assignment of assignments) {
      await PermissionAssignmentRepository.create(assignment);
    }
  }

  await permissionCache.invalidateMemberCache(userId, organizationId);
};

/**
 * Batch create members for an organization
 */
export const batchCreateMembers = async (organizationId, membersData, actorId) => {
  const results = { success: [], failed: [] };

  return await db.transaction(async (tx) => {
    const ownerRole = await RoleRepository.findOne({ organizationId, key: 'SYSTEM_OWNER' });
    const ownerRoleIdStr = ownerRole?.id;

    for (const memberData of membersData) {
      const { username, email, password, roleIds = [], departmentIds = [] } = memberData;

      try {
        if (!username || !email || !password) {
          results.failed.push({ email, reason: 'Missing required fields' });
          continue;
        }

        let user = await UserRepository.findByCredentials(email) || await UserRepository.findByCredentials(username);
        let isNewUser = false;

        if (!user) {
          user = await UserRepository.createUser({
            username,
            email,
            password,
            nickname: memberData.nickname || username,
          });
          isNewUser = true;
        }

        const existingMember = await OrganizationMemberRepository.findOne(user.id, organizationId);

        if (existingMember) {
          results.failed.push({ email, username, reason: 'User is already a member' });
          continue;
        }

        const filteredRoleIds = ownerRoleIdStr
          ? roleIds.filter((id) => id.toString() !== ownerRoleIdStr)
          : roleIds;

        await OrganizationMemberRepository.create({
          userId: user.id,
          organizationId,
          roleIds: filteredRoleIds,
          departmentIds,
          status: 'ACTIVE',
        });

        await syncMemberAssignments(user.id, organizationId, filteredRoleIds, actorId);

        results.success.push({
          email,
          username,
          userId: user.id,
          message: isNewUser ? 'User created and added' : 'Existing user added',
        });
      } catch (err) {
        results.failed.push({ email, username, reason: err.message });
      }
    }

    for (const res of results.success) {
      await permissionCache.invalidateMemberCache(res.userId, organizationId);
    }

    return results;
  });
};

/**
 * Update member roles and departments
 */
export const updateMemberRoles = async (memberId, data, actorId) => {
  const { roleIds, departmentIds } = data;

  const member = await OrganizationMemberRepository.findById(memberId);
  if (!member) throw ApiError.notFound('Member not found');

  if (roleIds !== undefined) {
    const ownerRole = await RoleRepository.findOne({
      organizationId: member.organizationId,
      key: 'SYSTEM_OWNER',
    });
    const ownerRoleIdStr = ownerRole?.id;

    const currentRoleIds = member.roleIds.map((id) => id.toString());
    const hasOwnerRole = currentRoleIds.includes(ownerRoleIdStr);
    let finalRoleIds = roleIds;

    if (ownerRoleIdStr) {
      if (hasOwnerRole) {
        if (!roleIds.includes(ownerRoleIdStr)) finalRoleIds = [...roleIds, ownerRoleIdStr];
      } else {
        if (roleIds.includes(ownerRoleIdStr))
          finalRoleIds = roleIds.filter((id) => id.toString() !== ownerRoleIdStr);
      }
    }

    const updatePayload = {};
    if (roleIds !== undefined) updatePayload.roleIds = finalRoleIds;
    if (departmentIds !== undefined) updatePayload.departmentIds = departmentIds;

    await OrganizationMemberRepository.update(member.id, updatePayload);
    await permissionCache.invalidateMemberCache(member.userId, member.organizationId);

    if (roleIds !== undefined) {
      await syncMemberAssignments(member.userId, member.organizationId, finalRoleIds, actorId);
    }

    return { ...member, ...updatePayload };
  }

  if (departmentIds !== undefined) {
    await OrganizationMemberRepository.update(member.id, { departmentIds });
    await permissionCache.invalidateMemberCache(member.userId, member.organizationId);
    return { ...member, departmentIds };
  }

  return member;
};

export default {
  syncMemberAssignments,
  batchCreateMembers,
  updateMemberRoles,
};
