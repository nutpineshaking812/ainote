import OrganizationMemberRepository from '../repositories/organizationMember.repository.js';
import permissionEngine from './permissionEngine.service.js';

/**
 * permissionCache.service.js
 *
 * Manages the lifecycle of the permission bitmap cache stored in OrganizationMember.
 */

/**
 * Re-calculate and update the cache for a specific member.
 */
export const updateMemberCache = async (userId, organizationId) => {
  const permissions = await permissionEngine.calculatePermissions(userId, organizationId);
  if (!permissions) return;

  const member = await OrganizationMemberRepository.findOne(userId, organizationId);
  if (!member) return permissions;

  await OrganizationMemberRepository.update(member.id, {
    permCache: permissions,
    permCacheUpdatedAt: new Date(),
  });

  return permissions;
};

/**
 * Invalidate cache for a specific member (force recalculation on next request).
 */
export const invalidateMemberCache = async (userId, organizationId) => {
  permissionEngine.clearCache(userId, organizationId);
  const member = await OrganizationMemberRepository.findOne(userId, organizationId);
  if (!member) return;

  await OrganizationMemberRepository.update(member.id, {
    permCache: null,
    permCacheUpdatedAt: null,
  });
};

/**
 * Invalidate cache for all members of an organization.
 * Used when a Role's permissions change.
 */
export const invalidateOrganizationCaches = async (organizationId) => {
  permissionEngine.clearCache(null, organizationId);
  await OrganizationMemberRepository.invalidateOrgCache(organizationId);
};

/**
 * Invalidate cache for all members belonging to a specific department.
 */
export const invalidateDepartmentMembersCache = async (departmentId, organizationId) => {
  // Clearing entire org cache for simplicity when department changes,
  // or we could find members of that department.
  permissionEngine.clearCache(null, organizationId);
  await OrganizationMemberRepository.invalidateDeptCache(departmentId, organizationId);
};

export default {
  updateMemberCache,
  invalidateMemberCache,
  invalidateOrganizationCaches,
  invalidateDepartmentMembersCache,
};
