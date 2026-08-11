import PermissionAssignmentRepository from '../repositories/permissionAssignment.repository.js';
import ApplicationRepository from '../repositories/application.repository.js';
import OrganizationMemberRepository from '../repositories/organizationMember.repository.js';
import RoleRepository from '../repositories/role.repository.js';
import DepartmentRepository from '../repositories/department.repository.js';
import UserRepository from '../repositories/user.repository.js';
import ApiError from '../utils/ApiError.js';
import { APP_PERMISSIONS, TEMPLATE_DEFAULT_ROLES } from '../constants/permissions.js';
import accessService from './access.service.js';
import permissionCache from './permissionCache.service.js';
import permissionEngine from './permissionEngine.service.js';

export const getAppPermissions = async (appId, userId) => {
  if (userId) {
    await accessService.ensureAppOwnership(appId, userId);
  }

  const app = await ApplicationRepository.findById(appId);
  if (!app) {
    throw ApiError.notFound('Application not found', 'APP_NOT_FOUND');
  }

  const assignments = await PermissionAssignmentRepository.findAssignments({
    resourceId: appId,
    scope: 'APP',
  });

  // Filter out app owner assignments manually if needed, or keep all
  const filteredAssignments = assignments.filter(a => 
    a.principalType !== 'USER' || a.principalId !== app.owner.toString()
  );

  const roleIds = [...new Set(filteredAssignments.map(a => a.roleId?.toString()).filter(Boolean))];
  const roles = roleIds.length > 0 ? await RoleRepository.findByIds(roleIds) : [];
  const roleMap = Object.fromEntries(roles.map(r => [r.id, r]));

  const permissions = filteredAssignments.map((a) => {
    const role = roleMap[a.roleId?.toString()];
    return {
      _id: a.id,
      appId: a.resourceId,
      permissionType: role?.permissions?.[0] || APP_PERMISSIONS.APP_VIEW,
      targetType: a.principalType,
      targetId: a.principalId,
      roleId: role,
      createdBy: a.createdBy,
      createdAt: a.createdAt,
    };
  });

  const allUserIds = [
    ...new Set([
      ...filteredAssignments.map((a) => a.createdBy?.toString()).filter(Boolean),
      ...permissions
        .filter((p) => p.targetType === 'USER')
        .map((p) => p.targetId?.toString())
        .filter(Boolean),
    ]),
  ];

  const users = allUserIds.length > 0 ? await UserRepository.findByIds(allUserIds) : [];
  const userMap = Object.fromEntries(
    users.map((u) => [
      u.id,
      { id: u.id, username: u.username, nickname: u.nickname, email: u.email },
    ]),
  );

  for (const perm of permissions) {
    if (perm.createdBy) {
      perm.createdBy = userMap[perm.createdBy.toString()];
    }

    if (perm.targetId && perm.targetType !== 'ALL') {
      let target = null;
      switch (perm.targetType) {
        case 'ROLE':
          target = await RoleRepository.findById(perm.targetId);
          if (target) target = { id: target.id, name: target.name };
          break;
        case 'DEPARTMENT':
          target = await DepartmentRepository.findById(perm.targetId);
          break;
        case 'USER':
          target = userMap[perm.targetId.toString()];
          break;
      }
      perm.targetId = target;
    }
  }

  return permissions;
};

export const addAppPermission = async (appId, permissionData, userId) => {
  await accessService.ensureAppOwnership(appId, userId);
  const { roleId, targetType, targetId } = permissionData;

  const app = await ApplicationRepository.findById(appId);
  if (!app) {
    throw ApiError.notFound('Application not found', 'APP_NOT_FOUND');
  }
  const organizationId = app.organizationId;

  const role = await RoleRepository.findById(roleId);
  if (!role) {
    throw ApiError.notFound('Role not found', 'ROLE_NOT_FOUND');
  }

  if (role.scope === 'APP' && role.appId?.toString() !== appId.toString()) {
    throw ApiError.badRequest('Role does not belong to this app', 'INVALID_ROLE');
  }

  const principalId = targetType === 'ALL' ? organizationId : targetId;

  const existing = await PermissionAssignmentRepository.findOne({
    organizationId,
    principalType: targetType,
    principalId,
    roleId: role.id,
    scope: 'APP',
    resourceId: appId,
  });

  if (existing) {
    throw ApiError.conflict('This permission already exists', 'PERMISSION_EXISTS');
  }

  const assignment = await PermissionAssignmentRepository.create({
    organizationId,
    principalType: targetType,
    principalId,
    roleId: role.id,
    roleKey: role.key,
    scope: 'APP',
    resourceId: appId,
    createdBy: userId,
  });

  if (targetType === 'USER') {
    await permissionCache.invalidateMemberCache(targetId, organizationId);
  } else if (targetType === 'DEPARTMENT') {
    await permissionCache.invalidateDepartmentMembersCache(targetId, organizationId);
  } else {
    await permissionCache.invalidateOrganizationCaches(organizationId);
  }

  return { ...assignment, _id: assignment.id };
};

export const removeAppPermission = async (assignmentId, appId, userId) => {
  await accessService.ensureAppOwnership(appId, userId);
  const assignment = await PermissionAssignmentRepository.findById(assignmentId);

  if (!assignment) {
    throw ApiError.notFound('Permission not found', 'PERMISSION_NOT_FOUND');
  }

  if (assignment.resourceId.toString() !== appId.toString()) {
    throw ApiError.forbidden('Permission does not belong to this app', 'PERMISSION_MISMATCH');
  }

  const { principalId, principalType, organizationId } = assignment;

  await PermissionAssignmentRepository.delete(assignmentId);

  if (principalType === 'USER') {
    await permissionCache.invalidateMemberCache(principalId, organizationId);
  } else if (principalType === 'DEPARTMENT') {
    await permissionCache.invalidateDepartmentMembersCache(principalId, organizationId);
  } else {
    await permissionCache.invalidateOrganizationCaches(organizationId);
  }
};

export const updateAppPermission = async (assignmentId, appId, updateData, userId) => {
  await accessService.ensureAppOwnership(appId, userId);
  const assignment = await PermissionAssignmentRepository.findById(assignmentId);
  if (!assignment) {
    throw ApiError.notFound('Permission not found', 'PERMISSION_NOT_FOUND');
  }

  if (assignment.resourceId.toString() !== appId.toString()) {
    throw ApiError.forbidden('Permission does not belong to this app', 'PERMISSION_MISMATCH');
  }

  const { roleId } = updateData;
  if (roleId) {
    const role = await RoleRepository.findById(roleId);
    if (!role) {
      throw ApiError.notFound('Role not found', 'ROLE_NOT_FOUND');
    }
    // Logic to update roleId in assignment (we'll need a repository update method)
    // For now, let's keep it simple or implement the update in repository
  }

  // Refactor update logic if needed
  return { ...assignment, _id: assignment.id };
};

export const createDefaultPermissions = async (appId, ownerId) => {
  const app = await ApplicationRepository.findById(appId);
  if (!app) return;
  const organizationId = app.organizationId;

  const templates = await RoleRepository.findByOrganization(organizationId, { scope: 'TEMPLATE' });
  const createdRoles = [];

  if (templates && templates.length > 0) {
    for (const template of templates) {
      const instanceKey = template.key ? template.key.replace('TEMPLATE_', 'APP_') : null;
      const newRole = await RoleRepository.create({
        key: instanceKey,
        name: template.name,
        organizationId,
        scope: 'APP',
        appId: appId.toString(),
        permissions: template.permissions,
        description: template.description,
        isSystem: false,
      });
      createdRoles.push(newRole);
    }
  } else {
    const defaultSpecs = Object.values(TEMPLATE_DEFAULT_ROLES);
    for (const spec of defaultSpecs) {
      const instanceKey = spec.key.replace('TEMPLATE_', 'APP_');
      const role = await RoleRepository.create({
        key: instanceKey,
        name: spec.name,
        organizationId,
        scope: 'APP',
        appId: appId.toString(),
        permissions: spec.permissions,
        description: spec.description,
        isSystem: false,
      });
      createdRoles.push(role);
    }
  }

  for (const role of createdRoles) {
    const hasHighPrivilege =
      role.key === 'APP_ADMIN' ||
      role.key === 'APP_DEVELOPER' ||
      role.permissions.some(
        (p) => p === APP_PERMISSIONS.APP_MANAGE || p === APP_PERMISSIONS.APP_VIEW,
      );

    if (hasHighPrivilege) {
      await PermissionAssignmentRepository.create({
        organizationId,
        principalType: 'USER',
        principalId: ownerId.toString(),
        roleId: role.id,
        roleKey: role.key,
        scope: 'APP',
        resourceId: appId.toString(),
        createdBy: ownerId.toString(),
      });
    }
  }

  await permissionCache.invalidateMemberCache(ownerId, organizationId);
};

export const getUserAppPermissions = async (appId, userId, organizationId) => {
  const permissions = await permissionEngine.calculatePermissions(userId, organizationId);
  if (!permissions) return [];
  if (permissions.isOwner) return Object.values(APP_PERMISSIONS);
  return permissions.apps[appId.toString()] || [];
};

export const getAccessibleAppIds = async (userId, organizationId) => {
  const permissions = await permissionEngine.calculatePermissions(userId, organizationId);
  if (!permissions) return [];

  const isAdmin = permissions.isOwner || permissions.global.includes('ORG_MANAGE');

  if (isAdmin) {
    const allApps = await ApplicationRepository.findByOrganization(organizationId);
    return allApps.map((a) => a.id);
  }

  const ownedApps = await ApplicationRepository.findByOwner(userId, organizationId);
  const accessibleSet = new Set(ownedApps.map((a) => a.id));

  Object.entries(permissions.apps).forEach(([appId, perms]) => {
    if (perms && perms.length > 0 && perms.includes(APP_PERMISSIONS.APP_VIEW)) {
      accessibleSet.add(appId);
    }
  });

  return Array.from(accessibleSet);
};

export const hasAppPermission = async (appId, userId, organizationId, permissionType) => {
  return permissionEngine.hasPermission(userId, organizationId, appId, permissionType, 'APP');
};

export const deleteAllAppPermissions = async (appId) => {
  await PermissionAssignmentRepository.deleteMany({ resourceId: appId, scope: 'APP' });
};

export default {
  getAppPermissions,
  addAppPermission,
  removeAppPermission,
  updateAppPermission,
  createDefaultPermissions,
  getUserAppPermissions,
  hasAppPermission,
  getAccessibleAppIds,
  deleteAllAppPermissions,
};
