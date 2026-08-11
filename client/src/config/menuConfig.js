import {
  SettingOutlined,
  TeamOutlined,
  SafetyOutlined,
  ApartmentOutlined,
  UserOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  ApiOutlined,
  BlockOutlined,
} from '@ant-design/icons';
import { PERMISSIONS, APP_PERMISSIONS } from '../constants/permissions';

/**
 * 侧边栏菜单配置
 * 支持权限过滤
 */
export const adminMenuConfig = [
  {
    key: 'org-settings',
    label: '组织设置',
    icon: SettingOutlined,
    path: '/admin/organization',
    permission: PERMISSIONS.ORG_MANAGE,
    scope: 'org',
  },
  {
    key: 'members',
    label: '成员管理',
    icon: TeamOutlined,
    path: '/admin/members',
    permission: PERMISSIONS.MEMBER_MANAGE,
    scope: 'org',
  },
  {
    key: 'roles',
    label: '角色管理',
    icon: SafetyOutlined,
    path: '/admin/admins',
    permission: PERMISSIONS.ROLE_MANAGE,
    scope: 'org',
  },
  {
    key: 'role-templates',
    label: '角色模板',
    icon: FileTextOutlined,
    path: '/admin/role-templates',
    permission: PERMISSIONS.ROLE_MANAGE,
    scope: 'org',
  },
  {
    key: 'departments',
    label: '部门管理',
    icon: ApartmentOutlined,
    path: '/admin/departments',
    permission: PERMISSIONS.DEPT_MANAGE,
    scope: 'org',
  },
  {
    key: 'widgets',
    label: '挂件管理',
    icon: BlockOutlined,
    path: '/admin/widgets',
    permission: PERMISSIONS.WIDGET_MANAGE,
    scope: 'org',
  },
];

/**
 * 应用设置菜单配置
 */
export const appSettingsMenuConfig = [
  {
    key: 'app-info',
    label: '应用信息',
    icon: AppstoreOutlined,
    path: '/app/:appId/settings/info',
    permission: APP_PERMISSIONS.MANAGE,
    scope: 'app',
  },
  {
    key: 'permissions',
    label: '权限管理',
    icon: SafetyOutlined,
    path: '/app/:appId/settings/permissions',
    permission: APP_PERMISSIONS.MANAGE,
    scope: 'app',
  },
  {
    key: 'developer',
    label: '开发者设置',
    icon: ApiOutlined,
    path: '/app/:appId/settings/developer',
    permission: APP_PERMISSIONS.MANAGE,
    scope: 'app',
  },
];

/**
 * 过滤菜单项（根据权限）
 * @param {Array} menuItems - 菜单配置数组
 * @param {Function} hasPermission - 权限检查函数
 * @returns {Array} 过滤后的菜单项
 */
export const filterMenuByPermission = (menuItems, hasPermission) => {
  return menuItems.filter((item) => {
    // 如果没有权限要求，直接显示
    if (!item.permission) return true;

    // 检查权限
    return hasPermission(item.permission);
  });
};

export default {
  adminMenuConfig,
  appSettingsMenuConfig,
  filterMenuByPermission,
};
