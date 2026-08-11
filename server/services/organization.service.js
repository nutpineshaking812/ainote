import OrganizationRepository from '../repositories/organization.repository.js';
import RoleRepository from '../repositories/role.repository.js';
import OrganizationMemberRepository from '../repositories/organizationMember.repository.js';
import PermissionAssignmentRepository from '../repositories/permissionAssignment.repository.js';
import ApplicationRepository from '../repositories/application.repository.js';
import QuotaRepository from '../repositories/quota.repository.js';
import InvitationRepository from '../repositories/invitation.repository.js';
import permissionCache from './permissionCache.service.js';
import * as appPermissionService from './appPermission.service.js';
import { DEFAULT_ROLES, TEMPLATE_DEFAULT_ROLES } from '../constants/permissions.js';
import crypto from 'crypto';
import env from '../config/env.js';
import DepartmentRepository from '../repositories/department.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { db } from '../db/index.js';
import { syncMemberAssignments } from './member.service.js';

export const createOrganization = async (data) => {
  const { name, ownerId, description = '' } = data;

  // 1. Create organization
  const organization = await OrganizationRepository.create({
    name,
    ownerId,
    description,
    status: 'ACTIVE',
  });

  const now = new Date();
  const globalRoles = await RoleRepository.batchCreate(
    Object.values(DEFAULT_ROLES).map((roleConfig, index) => ({
      key: roleConfig.key,
      name: roleConfig.name,
      nameEn: roleConfig.nameEn,
      permissions: roleConfig.permissions,
      isSystem: roleConfig.isSystem,
      organizationId: organization.id,
      scope: 'GLOBAL',
      description: roleConfig.description,
      descriptionEn: roleConfig.descriptionEn,
      createdAt: new Date(now.getTime() + index * 1000),
    })),
  );

  await RoleRepository.batchCreate(
    Object.values(TEMPLATE_DEFAULT_ROLES).map((templateConfig, index) => ({
      key: templateConfig.key,
      name: templateConfig.name,
      nameEn: templateConfig.nameEn,
      permissions: templateConfig.permissions,
      isSystem: true,
      organizationId: organization.id,
      scope: 'TEMPLATE',
      description: templateConfig.description,
      descriptionEn: templateConfig.descriptionEn,
      createdAt: new Date(now.getTime() + (index + 10) * 1000),
    })),
  );

  const ownerRole = globalRoles.find((r) => r.key === 'SYSTEM_OWNER');

  await OrganizationMemberRepository.create({
    userId: ownerId,
    organizationId: organization.id,
    roleIds: [ownerRole.id],
    departmentIds: [],
    status: 'ACTIVE',
    joinedAt: new Date(),
  });

  await PermissionAssignmentRepository.create({
    organizationId: organization.id,
    principalType: 'USER',
    principalId: ownerId,
    roleId: ownerRole.id,
    scope: 'GLOBAL',
    resourceId: organization.id,
    createdBy: ownerId,
  });

  await QuotaRepository.create({
    targetType: 'ORG',
    targetId: organization.id,
    tokenBalance: env.DEFAULT_TOKEN_BALANCE || 1000000,
    memberLimit: env.DEFAULT_ORG_MEMBER_LIMIT || 50,
  });

  await permissionCache.updateMemberCache(ownerId, organization.id);
  return organization;
};

export const createPersonalOrganization = async (ownerId, nickname) => {
  const name = `${nickname || '个人'}的空间`;

  const organization = await OrganizationRepository.create({
    name,
    ownerId,
    type: 'PERSONAL',
    status: 'ACTIVE',
  });

  const now = new Date();
  const globalRoles = await RoleRepository.batchCreate(
    Object.values(DEFAULT_ROLES).map((roleConfig, index) => ({
      key: roleConfig.key,
      name: roleConfig.name,
      nameEn: roleConfig.nameEn,
      permissions: roleConfig.permissions,
      isSystem: roleConfig.isSystem,
      organizationId: organization.id,
      scope: 'GLOBAL',
      description: roleConfig.description,
      descriptionEn: roleConfig.descriptionEn,
      createdAt: new Date(now.getTime() + index * 1000),
    })),
  );

  await RoleRepository.batchCreate(
    Object.values(TEMPLATE_DEFAULT_ROLES).map((templateConfig, index) => ({
      key: templateConfig.key,
      name: templateConfig.name,
      nameEn: templateConfig.nameEn,
      permissions: templateConfig.permissions,
      isSystem: true,
      organizationId: organization.id,
      scope: 'TEMPLATE',
      description: templateConfig.description,
      descriptionEn: templateConfig.descriptionEn,
      createdAt: new Date(now.getTime() + (index + 10) * 1000),
    })),
  );

  const ownerRole = globalRoles.find((r) => r.key === 'SYSTEM_OWNER');

  await OrganizationMemberRepository.create({
    userId: ownerId,
    organizationId: organization.id,
    roleIds: [ownerRole.id],
    departmentIds: [],
    status: 'ACTIVE',
    joinedAt: new Date(),
  });

  await PermissionAssignmentRepository.create({
    organizationId: organization.id,
    principalType: 'USER',
    principalId: ownerId,
    roleId: ownerRole.id,
    scope: 'GLOBAL',
    resourceId: organization.id,
    createdBy: ownerId,
  });

  await QuotaRepository.create({
    targetType: 'ORG',
    targetId: organization.id,
    tokenBalance: env.DEFAULT_TOKEN_BALANCE || 1000000,
    memberLimit: 1,
  });

  const app = await ApplicationRepository.create({
    name: '我的空间',
    description: '你的第一个个人工作空间',
    icon: 'RocketOutlined',
    iconColor: '#00b96b',
    owner: ownerId,
    organizationId: organization.id,
  });

  await appPermissionService.createDefaultPermissions(app.id, ownerId);

  return organization;
};

export const getUserOrganizations = async (userId) => {
  const memberships = await OrganizationMemberRepository.findByUserId(userId);
  const activeMemberships = memberships.filter((m) => m.status === 'ACTIVE');

  if (activeMemberships.length === 0) return [];

  const results = [];
  for (const m of activeMemberships) {
    const organization = await OrganizationRepository.findById(m.organizationId);
    if (organization && organization.status === 'ACTIVE') {
      const roles = await RoleRepository.findByIds(m.roleIds || []);
      const departments = await DepartmentRepository.findAll(m.departmentIds || []);

      results.push({
        organization,
        roles,
        departments,
        joinedAt: m.joinedAt,
      });
    }
  }

  return results;
};

export const getUserPermissions = async (userId, organizationId) => {
  const member = await OrganizationMemberRepository.findOne(userId, organizationId);
  if (!member || member.status !== 'ACTIVE') return [];

  const roles = await RoleRepository.findByIds(member.roleIds || []);
  const permissionsSet = new Set();
  roles.forEach((role) => {
    if (role.permissions) {
      role.permissions.forEach((perm) => permissionsSet.add(perm));
    }
  });

  return Array.from(permissionsSet);
};

export const getOrgQuota = async (organizationId) => {
  let quota = await QuotaRepository.findOne('ORG', organizationId);
  if (!quota) {
    quota = await QuotaRepository.create({
      targetType: 'ORG',
      targetId: organizationId,
      tokenBalance: env.DEFAULT_TOKEN_BALANCE || 1000000,
      memberLimit: env.DEFAULT_ORG_MEMBER_LIMIT || 50,
    });
  }

  const members = await OrganizationMemberRepository.findByOrganization(organizationId.toString());
  const memberCount = members.filter((m) => m.status === 'ACTIVE').length;

  return {
    tokenBalance: quota.tokenBalance,
    totalTokenUsage: quota.totalTokenUsage,
    memberLimit: quota.memberLimit,
    currentMemberCount: memberCount,
  };
};

export const generateOrgInvitation = async (organizationId, inviterId, options = {}) => {
  const { maxUses = 10, expiresAt } = options;

  const quota = await QuotaRepository.findOne('ORG', organizationId);
  if (!quota) throw ApiError.notFound('Organization quota not found');

  if (quota.memberLimit !== -1) {
    const members = await OrganizationMemberRepository.findByOrganization(
      organizationId.toString(),
    );
    const memberCount = members.filter((m) => m.status === 'ACTIVE').length;
    if (memberCount >= quota.memberLimit) {
      throw ApiError.forbidden('Organization has reached its member limit', 'MEMBER_LIMIT_REACHED');
    }
  }

  const code = crypto.randomBytes(4).toString('hex').toUpperCase();

  return InvitationRepository.create({
    code,
    inviter: inviterId,
    targetOrganizationId: organizationId,
    type: 'ORG_JOIN',
    maxUses,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  });
};

export const transferOwnership = async (organizationId, currentOwnerId, newOwnerId, actorId) => {
  const organization = await OrganizationRepository.findById(organizationId);
  if (!organization) throw ApiError.notFound('Organization not found');

  if (organization.ownerId !== currentOwnerId.toString()) {
    throw ApiError.forbidden('Only the current owner can transfer ownership');
  }

  const newOwnerMember = await OrganizationMemberRepository.findOne(newOwnerId, organizationId);
  if (!newOwnerMember || newOwnerMember.status !== 'ACTIVE') {
    throw ApiError.badRequest('New owner must be an active member of the organization');
  }

  const ownerRole = await RoleRepository.findOne({ organizationId, key: 'SYSTEM_OWNER' });
  if (!ownerRole) throw ApiError.internal('System Owner role not found');

  let adminRole = await RoleRepository.findOne({ organizationId, key: 'SYSTEM_ADMIN' });
  if (!adminRole) adminRole = ownerRole;

  await OrganizationRepository.update(organizationId, { ownerId: newOwnerId });

  const currentOwnerMember = await OrganizationMemberRepository.findOne(
    currentOwnerId,
    organizationId,
  );

  if (currentOwnerMember) {
    const updatedRoles = currentOwnerMember.roleIds
      .filter((id) => id.toString() !== ownerRole.id)
      .concat([adminRole.id]);

    const uniqueRoles = [...new Set(updatedRoles)];
    await OrganizationMemberRepository.update(currentOwnerMember.id, { roleIds: uniqueRoles });
  }

  const newRoles = [...new Set([...(newOwnerMember.roleIds || []), ownerRole.id])];
  await OrganizationMemberRepository.update(newOwnerMember.id, { roleIds: newRoles });

  await PermissionAssignmentRepository.deleteMany({
    organizationId,
    principalId: currentOwnerId,
    roleId: ownerRole.id,
  });

  // Simplified transfer: just recreate assignments for global roles
  await PermissionAssignmentRepository.deleteMany({
    organizationId,
    principalId: currentOwnerId,
    scope: 'GLOBAL',
  });
  await PermissionAssignmentRepository.create({
    organizationId,
    principalType: 'USER',
    principalId: currentOwnerId,
    roleId: adminRole.id,
    roleKey: adminRole.key,
    scope: 'GLOBAL',
    resourceId: organizationId,
    createdBy: actorId,
  });

  await PermissionAssignmentRepository.deleteMany({
    organizationId,
    principalId: newOwnerId,
    scope: 'GLOBAL',
  });
  await PermissionAssignmentRepository.create({
    organizationId,
    principalType: 'USER',
    principalId: newOwnerId,
    roleId: ownerRole.id,
    roleKey: ownerRole.key,
    scope: 'GLOBAL',
    resourceId: organizationId,
    createdBy: actorId,
  });

  await permissionCache.invalidateMemberCache(currentOwnerId, organizationId);
  await permissionCache.invalidateMemberCache(newOwnerId, organizationId);

  return organization;
};

export const joinOrganizationByCode = async (userId, code) => {
  if (!code) {
    throw ApiError.badRequest('Invitation code is required', 'INVITE_CODE_REQUIRED');
  }

  const invitation = await InvitationRepository.findByCode(code);
  if (!invitation || invitation.type !== 'ORG_JOIN') {
    throw ApiError.badRequest(
      'Invalid or expired organization invitation code',
      'INVALID_INVITE_CODE',
    );
  }

  if (invitation.expiresAt && invitation.expiresAt < new Date()) {
    throw ApiError.badRequest('Invitation code has expired', 'INVITE_CODE_EXPIRED');
  }

  if (invitation.maxUses !== -1 && invitation.uses >= invitation.maxUses) {
    throw ApiError.badRequest('Invitation code has reached maximum uses', 'INVITE_CODE_FULL');
  }

  const organizationId = invitation.targetOrganizationId;
  if (!organizationId) {
    throw ApiError.badRequest(
      'Invitation code is not associated with an organization',
      'INVALID_INVITATION',
    );
  }

  const organization = await OrganizationRepository.findById(organizationId);
  if (!organization || organization.status !== 'ACTIVE') {
    throw ApiError.notFound('Organization not found or inactive', 'ORG_NOT_FOUND');
  }

  // Check if user is already a member
  const existingMember = await OrganizationMemberRepository.findOne(userId, organizationId);
  if (existingMember) {
    if (existingMember.status === 'ACTIVE') {
      throw ApiError.conflict('You are already a member of this organization', 'ALREADY_MEMBER');
    }
  }

  // Check organization quota limit
  const orgQuota = await QuotaRepository.findOne('ORG', organizationId);
  if (orgQuota && orgQuota.memberLimit !== -1) {
    const members = await OrganizationMemberRepository.findByOrganization(organizationId);
    const activeMembersCount = members.filter((m) => m.status === 'ACTIVE').length;
    if (activeMembersCount >= orgQuota.memberLimit) {
      throw ApiError.forbidden('The organization has reached its member limit', 'ORG_FULL');
    }
  }

  // Find default member role
  let memberRole = await RoleRepository.findOne({
    organizationId,
    key: 'SYSTEM_MEMBER',
  });

  if (!memberRole) {
    memberRole = await RoleRepository.findOne({
      organizationId,
      name: 'Member',
      isSystem: true,
    });
    if (memberRole) {
      await RoleRepository.update(memberRole.id, { key: 'SYSTEM_MEMBER' });
    }
  }

  if (!memberRole) {
    throw ApiError.internal('Default member role not found', 'ROLE_NOT_FOUND');
  }

  // Execute inside transaction
  await db.transaction(async (tx) => {
    if (existingMember) {
      // Reactivate membership
      await OrganizationMemberRepository.update(
        existingMember.id,
        null,
        {
          status: 'ACTIVE',
          roleIds: [memberRole.id],
          joinedAt: new Date(),
        },
        tx,
      );
    } else {
      // Create new membership
      await OrganizationMemberRepository.create(
        {
          userId,
          organizationId,
          roleIds: [memberRole.id],
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
        tx,
      );
    }

    // Sync permissions
    await syncMemberAssignments(userId, organizationId, [memberRole.id], invitation.inviter, {
      tx,
    });

    // Increment invitation uses
    await InvitationRepository.incrementUses(invitation.id, userId, tx);
  });

  // Invalidate cache
  await permissionCache.invalidateMemberCache(userId, organizationId);

  return organization;
};

export default {
  createOrganization,
  createPersonalOrganization,
  getUserOrganizations,
  getUserPermissions,
  getOrgQuota,
  generateOrgInvitation,
  transferOwnership,
  joinOrganizationByCode,
};
