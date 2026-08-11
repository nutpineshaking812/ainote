import RoleRepository from '../repositories/role.repository.js';
import OrganizationMemberRepository from '../repositories/organizationMember.repository.js';
import PermissionAssignmentRepository from '../repositories/permissionAssignment.repository.js';
import permissionCache from './permissionCache.service.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Create a new custom role
 */
export const createRole = async (organizationId, data) => {
  const { name, permissions, description, scope = 'GLOBAL', appId = null } = data;

  if (!name || !name.trim()) throw ApiError.badRequest('Role name is required');
  if (!permissions || !Array.isArray(permissions))
    throw ApiError.badRequest('Permissions array is required');

  if (scope === 'APP' && !appId)
    throw ApiError.badRequest('App ID is required for APP scoped roles');

  const existingRole = await RoleRepository.findOne({
    organizationId,
    name: name.trim(),
    scope,
    appId: appId || null,
  });

  if (existingRole) throw ApiError.conflict('Role name already exists in this scope');

  return await RoleRepository.create({
    organizationId,
    name: name.trim(),
    permissions,
    description: description || '',
    scope,
    appId: scope === 'APP' ? appId : null,
    isSystem: false,
  });
};

/**
 * Update an existing role
 */
export const updateRole = async (roleId, data) => {
  const { name, permissions, description, scope, appId } = data;

  const role = await RoleRepository.findById(roleId);
  if (!role) throw ApiError.notFound('Role not found');

  if (role.isSystem && name !== undefined && name !== role.name) {
    throw ApiError.forbidden('Cannot change system role name');
  }

  if (role.key === 'SYSTEM_OWNER' && (name !== undefined || permissions !== undefined)) {
    throw ApiError.forbidden('Cannot change SYSTEM_OWNER role');
  }

  const updates = {};

  if (name !== undefined && !role.isSystem) {
    if (!name.trim()) throw ApiError.badRequest('Role name cannot be empty');

    const existingRole = await RoleRepository.findOne({
      organizationId: role.organizationId,
      name: name.trim(),
      scope: scope || role.scope,
      appId: (scope === 'APP' ? appId : null) || role.appId,
    });

    if (existingRole && existingRole.id !== roleId) throw ApiError.conflict('Role name already exists');
    updates.name = name.trim();
  }

  if (permissions !== undefined) {
    if (!Array.isArray(permissions)) throw ApiError.badRequest('Permissions must be an array');
    updates.permissions = permissions;
  }

  if (description !== undefined) updates.description = description;

  if (scope !== undefined && !role.isSystem) {
    updates.scope = scope;
    updates.appId = scope === 'APP' && appId ? appId : null;
  }

  const updatedRole = await RoleRepository.update(roleId, updates);
  await permissionCache.invalidateOrganizationCaches(role.organizationId);
  return updatedRole;
};

/**
 * Delete a custom role
 */
export const deleteRole = async (roleId) => {
  const role = await RoleRepository.findById(roleId);
  if (!role) throw ApiError.notFound('Role not found');

  if (role.isSystem || role.key === 'SYSTEM_OWNER') {
    throw ApiError.forbidden('Cannot delete system roles or owner role');
  }

  await OrganizationMemberRepository.removeRoleFromAllMembers(roleId.toString());

  await PermissionAssignmentRepository.deleteMany({ roleId: roleId.toString() });

  await permissionCache.invalidateOrganizationCaches(role.organizationId);

  await RoleRepository.delete(roleId);
  return true;
};

export default {
  createRole,
  updateRole,
  deleteRole,
};
