import PermissionAssignmentRepository from '../repositories/permissionAssignment.repository.js';
import OrganizationMemberRepository from '../repositories/organizationMember.repository.js';
import OrganizationRepository from '../repositories/organization.repository.js';
import RoleRepository from '../repositories/role.repository.js';
import ApiError from '../utils/ApiError.js';
import { APP_PERMISSIONS } from '../constants/permissions.js';
import { logger } from '../config/logger.js';

/**
 * permissionEngine.service.js
 *
 * Core logic for aggregating and validating permissions across the system.
 */

const permCache = new Map();
const CACHE_TTL = 10000; // 10 seconds

/**
 * Clear the in-memory cache.
 */
export const clearCache = (userId, organizationId) => {
  if (userId && organizationId) {
    permCache.delete(`${userId}:${organizationId}`);
  } else if (organizationId) {
    for (const key of permCache.keys()) {
      if (key.endsWith(`:${organizationId}`)) {
        permCache.delete(key);
      }
    }
  } else {
    permCache.clear();
  }
};

/**
 * Calculate all effective permissions for a user in an organization.
 */
export const calculatePermissions = async (userId, organizationId) => {
  const cacheKey = `${userId}:${organizationId}`;
  const now = Date.now();

  const cached = permCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const member = await OrganizationMemberRepository.findOne(userId, organizationId);
  if (!member || member.status !== 'ACTIVE') {
    return null;
  }

  const principals = [userId.toString(), organizationId.toString()];
  if (member.departmentIds && member.departmentIds.length > 0) {
    principals.push(...member.departmentIds.map((id) => id.toString()));
  }
  if (member.roleIds && member.roleIds.length > 0) {
    principals.push(...member.roleIds.map((id) => id.toString()));
  }

  const assignments = await PermissionAssignmentRepository.findAssignments({
    organizationId,
    principalId: principals,
  });

  const roleIds = [...new Set(assignments.map(a => a.roleId?.toString()).filter(Boolean))];
  const roles = roleIds.length > 0 ? await RoleRepository.findByIds(roleIds) : [];
  const roleMap = Object.fromEntries(roles.map(r => [r.id, r]));

  const result = {
    global: new Set(),
    apps: {}, 
    resources: {},
  };

  const org = await OrganizationRepository.findById(organizationId);
  if (org && org.ownerId.toString() === userId.toString()) {
    result.isOwner = true;
  }

  for (const assignment of assignments) {
    const role = roleMap[assignment.roleId?.toString()];
    if (!role) continue;

    const perms = role.permissions || [];
    const resourceId = assignment.resourceId.toString();

    switch (assignment.scope) {
      case 'GLOBAL':
        perms.forEach((p) => result.global.add(p));
        break;
      case 'APP':
        if (perms.length > 0) {
          if (!result.apps[resourceId]) result.apps[resourceId] = new Set();
          perms.forEach((p) => result.apps[resourceId].add(p));
        }
        break;
      case 'RESOURCE':
        if (perms.length > 0) {
          if (!result.resources[resourceId]) result.resources[resourceId] = new Set();
          perms.forEach((p) => result.resources[resourceId].add(p));
        }
        break;
    }
  }

  const data = {
    global: Array.from(result.global),
    apps: Object.fromEntries(Object.entries(result.apps).map(([k, v]) => [k, Array.from(v)])),
    resources: Object.fromEntries(
      Object.entries(result.resources).map(([k, v]) => [k, Array.from(v)]),
    ),
    isOwner: result.isOwner || false,
    updatedAt: new Date(),
  };

  permCache.set(cacheKey, { data, timestamp: now });
  return data;
};

export const hasPermission = async (
  userId,
  organizationId,
  resourceId,
  permission,
  scope = 'APP',
) => {
  const permissions = await calculatePermissions(userId, organizationId);
  if (!permissions) return false;

  if (permissions.isOwner) return true;

  if (scope === 'GLOBAL') {
    return permissions.global.includes(permission);
  }

  if (scope === 'APP') {
    const appPerms = permissions.apps[resourceId] || [];
    if (appPerms.includes(APP_PERMISSIONS.APP_MANAGE)) return true;
    if (appPerms.includes(permission)) return true;
    return false;
  }

  if (scope === 'RESOURCE') {
    const resPerms = permissions.resources[resourceId] || [];
    return resPerms.includes(permission);
  }

  return false;
};

export const getUserAudit = async (userId, organizationId) => {
  const member = await OrganizationMemberRepository.findOne(userId, organizationId);
  if (!member) return [];

  const principals = [userId.toString(), ...(member.departmentIds || []).map(id => id.toString())];

  const assignments = await PermissionAssignmentRepository.findAssignments({
    organizationId,
    principalId: principals,
  });

  const roleIds = [...new Set(assignments.map(a => a.roleId?.toString()).filter(Boolean))];
  const roles = roleIds.length > 0 ? await RoleRepository.findByIds(roleIds) : [];
  const roleMap = Object.fromEntries(roles.map(r => [r.id, r]));

  return assignments.map(a => ({
    ...a,
    _id: a.id,
    roleId: roleMap[a.roleId?.toString()]
  }));
};

export const getResourceAudit = async (resourceId, organizationId) => {
  const assignments = await PermissionAssignmentRepository.findAssignments({
    organizationId,
    resourceId,
  });

  const roleIds = [...new Set(assignments.map(a => a.roleId?.toString()).filter(Boolean))];
  const roles = roleIds.length > 0 ? await RoleRepository.findByIds(roleIds) : [];
  const roleMap = Object.fromEntries(roles.map(r => [r.id, r]));

  return assignments.map(a => ({
    ...a,
    _id: a.id,
    roleId: roleMap[a.roleId?.toString()]
  }));
};

export default {
  calculatePermissions,
  hasPermission,
  getUserAudit,
  getResourceAudit,
  clearCache,
};
