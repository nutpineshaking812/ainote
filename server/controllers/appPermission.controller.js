import asyncHandler from 'express-async-handler';
import { sendSuccess } from '../utils/response.js';
import appPermissionService from '../services/appPermission.service.js';

/**
 * @desc    获取应用的权限配置列表
 * @route   GET /api/v1/apps/:appId/permissions
 * @access  Private
 */
export const getAppPermissions = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const permissions = await appPermissionService.getAppPermissions(appId, req.user.id);
  sendSuccess(res, permissions);
});

/**
 * @desc    添加应用权限配置
 * @route   POST /api/v1/apps/:appId/permissions
 * @access  Private
 */
export const addAppPermission = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const permission = await appPermissionService.addAppPermission(appId, req.body, req.user.id);
  sendSuccess(res, permission, 201);
});

/**
 * @desc    删除应用权限配置
 * @route   DELETE /api/v1/apps/:appId/permissions/:permissionId
 * @access  Private
 */
export const removeAppPermission = asyncHandler(async (req, res) => {
  const { appId, permissionId } = req.params;
  await appPermissionService.removeAppPermission(permissionId, appId, req.user.id);
  sendSuccess(res, { message: 'Permission removed successfully' });
});

/**
 * @desc    更新应用权限配置
 * @route   PUT /api/v1/apps/:appId/permissions/:permissionId
 * @access  Private
 */
export const updateAppPermission = asyncHandler(async (req, res) => {
  const { appId, permissionId } = req.params;
  const permission = await appPermissionService.updateAppPermission(
    permissionId,
    appId,
    req.body,
    req.user.id,
  );
  sendSuccess(res, permission);
});

/**
 * @desc    获取当前用户对该应用的权限
 * @route   GET /api/v1/apps/:appId/my-permissions
 * @access  Private
 */
export const getMyAppPermissions = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const organizationId = req.headers['x-organization-id'];
  const permissions = await appPermissionService.getUserAppPermissions(
    appId,
    req.user.id,
    organizationId,
  );
  sendSuccess(res, permissions);
});

export default {
  getAppPermissions,
  addAppPermission,
  removeAppPermission,
  updateAppPermission,
  getMyAppPermissions,
};
