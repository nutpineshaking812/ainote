import { PERMISSIONS, APP_PERMISSIONS } from '../constants/permissions';

/**
 * 路由权限配置
 * 集中管理所有需要权限控制的路由
 */
export const routePermissionConfig = {
  // 组织管理路由
  '/admin/organization': {
    permission: PERMISSIONS.ORG_MANAGE,
    scope: 'org',
    title: '组织设置',
  },
  '/admin/members': {
    permission: PERMISSIONS.MEMBER_MANAGE,
    scope: 'org',
    title: '成员管理',
  },
  '/admin/admins': {
    permission: PERMISSIONS.ROLE_MANAGE,
    scope: 'org',
    title: '角色管理',
  },
  '/admin/role-templates': {
    permission: PERMISSIONS.ROLE_MANAGE,
    scope: 'org',
    title: '角色模板',
  },
  '/admin/departments': {
    permission: PERMISSIONS.DEPT_MANAGE,
    scope: 'org',
    title: '部门管理',
  },

  // 应用设置路由
  '/app/:appId/settings': {
    permission: APP_PERMISSIONS.MANAGE,
    scope: 'app',
    title: '应用设置',
  },
  '/app/:appId/settings/info': {
    permission: APP_PERMISSIONS.MANAGE,
    scope: 'app',
    title: '应用信息',
  },
  '/app/:appId/settings/permissions': {
    permission: APP_PERMISSIONS.MANAGE,
    scope: 'app',
    title: '权限管理',
  },
  '/app/:appId/settings/developer': {
    permission: APP_PERMISSIONS.MANAGE,
    scope: 'app',
    title: '开发者设置',
  },

  // 表单相关路由
  '/app/:appId/forms/:formId/edit': {
    permission: APP_PERMISSIONS.MANAGE,
    scope: 'app',
    title: '表单设计',
  },
  '/app/:appId/forms/:formId/data': {
    permission: APP_PERMISSIONS.VIEW,
    scope: 'app',
    title: '数据查看',
  },
  '/app/:appId/forms/:formId/fill': {
    permission: APP_PERMISSIONS.FILL,
    scope: 'app',
    title: '表单填写',
  },

  // 视图相关路由
  '/app/:appId/views/new': {
    permission: APP_PERMISSIONS.MANAGE,
    scope: 'app',
    title: '新建视图',
  },
  '/app/:appId/views/:viewId/edit': {
    permission: APP_PERMISSIONS.MANAGE,
    scope: 'app',
    title: '编辑视图',
  },
};

/**
 * 获取路由的权限配置
 * @param {string} path - 路由路径
 * @returns {object|null} 权限配置
 */
export const getRoutePermission = (path) => {
  return routePermissionConfig[path] || null;
};

/**
 * 检查路径是否需要权限
 * @param {string} path - 路由路径
 * @returns {boolean}
 */
export const requiresPermission = (path) => {
  return !!routePermissionConfig[path];
};

export default routePermissionConfig;
