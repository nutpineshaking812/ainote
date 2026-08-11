import api from './index.js';

/**
 * 获取应用的权限配置列表
 * @param {string} appId - 应用 ID
 * @returns {Promise<Array>} 权限配置列表
 */
export const getAppPermissions = async (appId) => {
  return api.get(`/apps/${appId}/permissions`);
};

/**
 * 添加应用权限配置
 * @param {string} appId - 应用 ID
 * @param {object} permissionData - 权限数据
 * @param {string} permissionData.permissionType - 权限类型 (FILL/MANAGE/VIEW)
 * @param {string} permissionData.targetType - 目标类型 (ALL/ROLE/DEPARTMENT/USER)
 * @param {string} [permissionData.targetId] - 目标 ID
 * @returns {Promise<Object>} 创建的权限配置
 */
export const addAppPermission = async (appId, permissionData) => {
  return api.post(`/apps/${appId}/permissions`, permissionData);
};

/**
 * 删除应用权限配置
 * @param {string} appId - 应用 ID
 * @param {string} permissionId - 权限配置 ID
 * @returns {Promise<void>}
 */
export const removeAppPermission = async (appId, permissionId) => {
  return api.delete(`/apps/${appId}/permissions/${permissionId}`);
};

/**
 * 更新应用权限配置
 * @param {string} appId - 应用 ID
 * @param {string} permissionId - 权限配置 ID
 * @param {object} permissionData - 更新的权限数据
 * @returns {Promise<Object>} 更新后的权限配置
 */
export const updateAppPermission = async (appId, permissionId, permissionData) => {
  return api.put(`/apps/${appId}/permissions/${permissionId}`, permissionData);
};

/**
 * 获取当前用户对该应用的权限
 * @param {string} appId - 应用 ID
 * @returns {Promise<Array>} 权限类型列表 ['FILL', 'VIEW']
 */
export const getMyAppPermissions = async (appId) => {
  return api.get(`/apps/${appId}/my-permissions`);
};

export default {
  getAppPermissions,
  addAppPermission,
  removeAppPermission,
  updateAppPermission,
  getMyAppPermissions,
};
