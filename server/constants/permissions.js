/**
 * 权限常量定义
 *
 * 双层权限体系：
 * 1. 组织级权限 (PERMISSIONS) - 控制"能力"：能否管理组织、创建应用等
 * 2. 应用级权限 (APP_PERMISSIONS) - 控制"操作"：对某个具体应用能做什么
 */

// ============================================
// 第一层：组织级权限（6个）
// 控制用户在组织内的"能力"
// ============================================
export const PERMISSIONS = {
  // 组织管理
  ORG_MANAGE: 'ORG_MANAGE', // 管理组织设置（名称、Logo等）
  MEMBER_MANAGE: 'MEMBER_MANAGE', // 管理成员（邀请、移除、修改角色）
  ROLE_MANAGE: 'ROLE_MANAGE', // 管理角色（创建、编辑、删除角色）
  DEPT_MANAGE: 'DEPT_MANAGE', // 管理部门（创建、编辑、删除部门）

  // 应用管理
  APP_CREATE: 'APP_CREATE', // 创建新应用
  APP_DELETE: 'APP_DELETE', // 删除应用（仅限自己创建的应用，Admin可删除所有）
};

// ============================================
// 第二层：应用级权限（3个）
// 控制用户对某个具体应用能做什么
// ============================================
export const APP_PERMISSIONS = {
  // Granular - Form
  FORM_DESIGN: 'form:design', // Create, Edit, Design, Delete
  FORM_VIEW: 'form:view', // View records
  FORM_FILL: 'form:fill', // Fill data
  FORM_EXPORT: 'form:export', // Export data
  FORM_PUBLISH: 'form:publish', // Publish/Manage public access

  // Granular - View
  VIEW_DESIGN: 'view:design', // Create, Edit, Design, Delete
  VIEW_VIEW: 'view:view', // Access/Read view

  // Granular - Doc
  DOC_MANAGE: 'doc:manage', // All document actions

  // Granular - App
  APP_MANAGE: 'app:manage', // App settings, permissions
  APP_VIEW: 'app:view', // Basic access
};

// ============================================
// 默认角色配置
// ============================================
export const DEFAULT_ROLES = {
  OWNER: {
    key: 'SYSTEM_OWNER',
    name: 'Owner',
    nameEn: 'Owner',
    permissions: Object.values(PERMISSIONS),
    isSystem: true,
    description: '组织所有者，拥有全部权限，不可被移除',
    descriptionEn: 'Organization owner with full permissions, cannot be removed',
  },
  ADMIN: {
    key: 'SYSTEM_ADMIN',
    name: 'Admin',
    nameEn: 'Admin',
    permissions: Object.values(PERMISSIONS),
    isSystem: true,
    description: '管理员，可管理组织、成员、角色和应用',
    descriptionEn: 'Administrator, can manage organization, members, roles, and applications',
  },
  CREATOR: {
    key: 'SYSTEM_CREATOR',
    name: 'Creator',
    nameEn: 'Creator',
    permissions: [PERMISSIONS.APP_CREATE],
    isSystem: true,
    description: '创作者，可创建应用',
    descriptionEn: 'Creator, can create applications',
  },
  MEMBER: {
    key: 'SYSTEM_MEMBER',
    name: 'Member',
    nameEn: 'Member',
    permissions: [],
    isSystem: true,
    description: '普通成员，通过应用级权限控制访问',
    descriptionEn: 'Regular member, access controlled via app-level permissions',
  },
};

/**
 * 默认应用角色模版
 */
export const TEMPLATE_DEFAULT_ROLES = {
  ADMIN: {
    key: 'TEMPLATE_ADMIN',
    name: '管理员',
    nameEn: 'Administrator',
    permissions: Object.values(APP_PERMISSIONS),
    description: '拥有应用的全部权限，包括设置和权限管理',
    descriptionEn: 'Full permissions for the app, including settings and permission management',
  },
  DEVELOPER: {
    key: 'TEMPLATE_DEVELOPER',
    name: '开发者',
    nameEn: 'App Developer',
    permissions: [
      APP_PERMISSIONS.FORM_DESIGN,
      APP_PERMISSIONS.FORM_VIEW,
      APP_PERMISSIONS.FORM_FILL,
      APP_PERMISSIONS.FORM_EXPORT,
      APP_PERMISSIONS.FORM_PUBLISH,
      APP_PERMISSIONS.VIEW_DESIGN,
      APP_PERMISSIONS.VIEW_VIEW,
      APP_PERMISSIONS.APP_VIEW,
    ],
    description: '可以设计和修改应用（表单、视图），拥有表单和视图的所有操作权限',
    descriptionEn:
      'Can design and modify the app (forms, views), with full access to forms and views',
  },
  OPERATOR: {
    key: 'TEMPLATE_OPERATOR',
    name: '操作员',
    nameEn: 'Operator',
    permissions: [
      APP_PERMISSIONS.FORM_VIEW,
      APP_PERMISSIONS.FORM_FILL,
      APP_PERMISSIONS.VIEW_VIEW,
      APP_PERMISSIONS.APP_VIEW,
    ],
    description: '可以查看和提交业务数据',
    descriptionEn: 'Can view and submit business data',
  },
  VIEWER: {
    key: 'TEMPLATE_VIEWER',
    name: '查看者',
    nameEn: 'Viewer',
    permissions: [APP_PERMISSIONS.FORM_VIEW, APP_PERMISSIONS.VIEW_VIEW, APP_PERMISSIONS.APP_VIEW],
    description: '仅能查看应用内容和数据',
    descriptionEn: 'Can only view app content and data',
  },
};

// ============================================
// 权限分组（用于 UI 展示）
// ============================================
export const PERMISSION_GROUPS = [
  {
    key: 'organization',
    label: '组织管理',
    labelEn: 'Organization Management',
    scope: 'GLOBAL',
    permissions: [
      {
        key: PERMISSIONS.ORG_MANAGE,
        label: '管理组织设置',
        labelEn: 'Manage Organization Settings',
      },
      { key: PERMISSIONS.MEMBER_MANAGE, label: '管理成员', labelEn: 'Manage Members' },
      { key: PERMISSIONS.ROLE_MANAGE, label: '管理角色', labelEn: 'Manage Roles' },
      { key: PERMISSIONS.DEPT_MANAGE, label: '管理部门', labelEn: 'Manage Departments' },
    ],
  },
  {
    key: 'application_mgmt',
    label: '应用管理',
    labelEn: 'Application Management',
    scope: 'GLOBAL',
    permissions: [
      { key: PERMISSIONS.APP_CREATE, label: '创建应用', labelEn: 'Create Applications' },
      { key: PERMISSIONS.APP_DELETE, label: '删除应用', labelEn: 'Delete Applications' },
    ],
  },
  {
    key: 'form_ops',
    label: '表单权限',
    labelEn: 'Form Permissions',
    scope: 'APP',
    permissions: [
      { key: APP_PERMISSIONS.FORM_DESIGN, label: '设计表单', labelEn: 'Design Form' },
      { key: APP_PERMISSIONS.FORM_VIEW, label: '查看数据', labelEn: 'View Data' },
      { key: APP_PERMISSIONS.FORM_FILL, label: '提交数据', labelEn: 'Fill Data' },
      { key: APP_PERMISSIONS.FORM_EXPORT, label: '导出数据', labelEn: 'Export Data' },
      { key: APP_PERMISSIONS.FORM_PUBLISH, label: '发布表单', labelEn: 'Publish Form' },
    ],
  },
  {
    key: 'view_ops',
    label: '视图权限',
    labelEn: 'View Permissions',
    scope: 'APP',
    permissions: [
      { key: APP_PERMISSIONS.VIEW_DESIGN, label: '设计视图', labelEn: 'Design View' },
      { key: APP_PERMISSIONS.VIEW_VIEW, label: '查看视图', labelEn: 'View Dashboard' },
    ],
  },
  {
    key: 'doc_ops',
    label: '文档权限',
    labelEn: 'Document Permissions',
    scope: 'APP',
    permissions: [
      { key: APP_PERMISSIONS.DOC_MANAGE, label: '管理文档', labelEn: 'Manage Documents' },
    ],
  },
  {
    key: 'app_sys',
    label: '系统权限',
    labelEn: 'System Permissions',
    scope: 'APP',
    permissions: [
      { key: APP_PERMISSIONS.APP_MANAGE, label: '超级管理', labelEn: 'Full Management' },
      { key: APP_PERMISSIONS.APP_VIEW, label: '基础访问', labelEn: 'Basic Access' },
    ],
  },
];
