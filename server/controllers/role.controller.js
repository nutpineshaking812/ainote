import asyncHandler from 'express-async-handler';
import { sendSuccess } from '../utils/response.js';
import RoleRepository from '../repositories/role.repository.js';
import * as roleService from '../services/role.service.js';

// @desc    Get all roles for an organization
// @route   GET /api/v1/roles
// @access  Private
export const getRoles = asyncHandler(async (req, res) => {
  const organizationId = req.headers['x-organization-id'];
  const { scope, appId } = req.query;

  const roles = await RoleRepository.findByOrganization(organizationId, { scope, appId });

  return sendSuccess(res, { 
    roles: roles.map(r => ({
      id: r.id,
      name: r.name,
      permissions: r.permissions,
      isSystem: r.isSystem,
      scope: r.scope,
      appId: r.appId,
      description: r.description,
    }))
  });
});

// @desc    Get organization global roles
export const getGlobalRoles = asyncHandler(async (req, res) => {
  const organizationId = req.headers['x-organization-id'];
  const roles = await RoleRepository.findByOrganization(organizationId, { scope: 'GLOBAL' });

  return sendSuccess(res, { 
    roles: roles.map(r => ({
      id: r.id,
      name: r.name,
      permissions: r.permissions,
      isSystem: r.isSystem,
      scope: r.scope,
      description: r.description,
    }))
  });
});

// @desc    Get organization role templates
export const getTemplateRoles = asyncHandler(async (req, res) => {
  const organizationId = req.headers['x-organization-id'];
  const roles = await RoleRepository.findByOrganization(organizationId, { scope: 'TEMPLATE' });

  return sendSuccess(res, { 
    roles: roles.map(r => ({
      id: r.id,
      name: r.name,
      permissions: r.permissions,
      isSystem: r.isSystem,
      scope: r.scope,
      description: r.description,
    }))
  });
});

// @desc    Get application-specific roles
export const getAppRoles = asyncHandler(async (req, res) => {
  const organizationId = req.headers['x-organization-id'];
  const { appId } = req.params;
  const roles = await RoleRepository.findByOrganization(organizationId, { scope: 'APP', appId });

  return sendSuccess(res, { 
    roles: roles.map(r => ({
      id: r.id,
      name: r.name,
      permissions: r.permissions,
      isSystem: r.isSystem,
      scope: r.scope,
      appId: r.appId,
      description: r.description,
    }))
  });
});

// @desc    Create a custom role
// @route   POST /api/v1/roles/create
export const createRole = asyncHandler(async (req, res) => {
  const organizationId = req.headers['x-organization-id'];
  const role = await roleService.createRole(organizationId, {
    ...req.body,
    organizationId,
  });
  return sendSuccess(res, { role }, 201);
});

// @desc    Update a custom role
// @route   POST /api/v1/roles/:id
export const updateRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const role = await roleService.updateRole(id, req.body);
  return sendSuccess(res, { role });
});

// @desc    Delete a custom role
// @route   POST /api/v1/roles/:id/delete
export const deleteRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await roleService.deleteRole(id);
  return sendSuccess(res, { message: 'Role deleted successfully' });
});

// @desc    Get available permissions list
export const getPermissions = asyncHandler(async (req, res) => {
  const { PERMISSIONS, PERMISSION_GROUPS } = await import('../constants/permissions.js');

  return sendSuccess(res, {
    permissions: Object.values(PERMISSIONS),
    groups: PERMISSION_GROUPS,
  });
});
