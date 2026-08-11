/**
 * 权限常量定义（前端）
 * 与后端 /server/constants/permissions.js 保持同步
 */

// ============================================
// 组织级权限（GLOBAL Scope）
// ============================================
export const PERMISSIONS = {
  // 组织管理
  ORG_MANAGE: 'ORG_MANAGE',
  MEMBER_MANAGE: 'MEMBER_MANAGE',
  ROLE_MANAGE: 'ROLE_MANAGE',
  DEPT_MANAGE: 'DEPT_MANAGE',
  WIDGET_MANAGE: 'WIDGET_MANAGE',

  // 应用管理
  APP_CREATE: 'APP_CREATE',
  APP_DELETE: 'APP_DELETE',
};

// ============================================
// 应用级权限（APP Scope）
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
// 资源级权限（RESOURCE Scope）
// ============================================
export const RESOURCE_PERMISSIONS = {
  VIEW: 'VIEW',
  EDIT: 'EDIT',
};

// ============================================
// 按钮权限映射
// ============================================
export const BUTTON_PERMISSIONS = {
  // 组织级按钮
  'create-app': { scope: 'org', permission: PERMISSIONS.APP_CREATE },
  'delete-app': { scope: 'org', permission: PERMISSIONS.APP_DELETE },
  'edit-org': { scope: 'org', permission: PERMISSIONS.ORG_MANAGE },
  'invite-member': { scope: 'org', permission: PERMISSIONS.MEMBER_MANAGE },
  'edit-member': { scope: 'org', permission: PERMISSIONS.MEMBER_MANAGE },
  'remove-member': { scope: 'org', permission: PERMISSIONS.MEMBER_MANAGE },
  'create-role': { scope: 'org', permission: PERMISSIONS.ROLE_MANAGE },
  'edit-role': { scope: 'org', permission: PERMISSIONS.ROLE_MANAGE },
  'delete-role': { scope: 'org', permission: PERMISSIONS.ROLE_MANAGE },
  'create-dept': { scope: 'org', permission: PERMISSIONS.DEPT_MANAGE },
  'edit-dept': { scope: 'org', permission: PERMISSIONS.DEPT_MANAGE },
  'delete-dept': { scope: 'org', permission: PERMISSIONS.DEPT_MANAGE },

  // 应用级按钮
  'create-form': { scope: 'app', permission: APP_PERMISSIONS.FORM_DESIGN },
  'edit-form': { scope: 'app', permission: APP_PERMISSIONS.FORM_DESIGN },
  'delete-form': { scope: 'app', permission: APP_PERMISSIONS.FORM_DESIGN },
  'design-form': { scope: 'app', permission: APP_PERMISSIONS.FORM_DESIGN },
  'create-view': { scope: 'app', permission: APP_PERMISSIONS.VIEW_DESIGN },
  'edit-view': { scope: 'app', permission: APP_PERMISSIONS.VIEW_DESIGN },
  'delete-view': { scope: 'app', permission: APP_PERMISSIONS.VIEW_DESIGN },
  'design-view': { scope: 'app', permission: APP_PERMISSIONS.VIEW_DESIGN },
  'create-document': { scope: 'app', permission: APP_PERMISSIONS.DOC_MANAGE },
  'delete-document': { scope: 'app', permission: APP_PERMISSIONS.DOC_MANAGE },
  'app-settings': { scope: 'app', permission: APP_PERMISSIONS.APP_MANAGE },
  'manage-permissions': { scope: 'app', permission: APP_PERMISSIONS.APP_MANAGE },
  'export-data': { scope: 'app', permission: APP_PERMISSIONS.FORM_EXPORT },
  'publish-form': { scope: 'app', permission: APP_PERMISSIONS.FORM_PUBLISH },
  'bulk-delete': { scope: 'app', permission: APP_PERMISSIONS.FORM_DESIGN },
  'fill-form': { scope: 'app', permission: APP_PERMISSIONS.FORM_FILL },
  'view-data': { scope: 'app', permission: APP_PERMISSIONS.FORM_VIEW },
  'view-form': { scope: 'app', permission: APP_PERMISSIONS.FORM_VIEW },
  'view-view': { scope: 'app', permission: APP_PERMISSIONS.VIEW_VIEW },

  // 资源级按钮
  'edit-document': { scope: 'resource', permission: RESOURCE_PERMISSIONS.EDIT },
  'edit-record': { scope: 'resource', permission: RESOURCE_PERMISSIONS.EDIT },
  'delete-record': { scope: 'resource', permission: RESOURCE_PERMISSIONS.EDIT },
  'view-document': { scope: 'resource', permission: RESOURCE_PERMISSIONS.VIEW },
  'view-record': { scope: 'resource', permission: RESOURCE_PERMISSIONS.VIEW },
};

// ============================================
// 路由权限映射
// ============================================
export const ROUTE_PERMISSIONS = {
  // 组织管理路由
  '/admin/organization': { scope: 'org', permission: PERMISSIONS.ORG_MANAGE },
  '/admin/members': { scope: 'org', permission: PERMISSIONS.MEMBER_MANAGE },
  '/admin/admins': { scope: 'org', permission: PERMISSIONS.ROLE_MANAGE },
  '/admin/role-templates': { scope: 'org', permission: PERMISSIONS.ROLE_MANAGE },
  '/admin/departments': { scope: 'org', permission: PERMISSIONS.DEPT_MANAGE },
  '/admin/widgets': { scope: 'org', permission: PERMISSIONS.WIDGET_MANAGE },

  // 应用管理路由
  '/app/:appId/settings': { scope: 'app', permission: APP_PERMISSIONS.APP_MANAGE },
  '/app/:appId/forms/new': { scope: 'app', permission: APP_PERMISSIONS.FORM_DESIGN },
  '/app/:appId/forms/:formId/edit': { scope: 'app', permission: APP_PERMISSIONS.FORM_DESIGN },
  '/app/:appId/views/new': { scope: 'app', permission: APP_PERMISSIONS.VIEW_DESIGN },
  '/app/:appId/views/:viewId/edit': { scope: 'app', permission: APP_PERMISSIONS.VIEW_DESIGN },
  '/app/:appId/forms/:formId/data': { scope: 'app', permission: APP_PERMISSIONS.FORM_VIEW },
  '/app/:appId/forms/:formId/fill': { scope: 'app', permission: APP_PERMISSIONS.FORM_FILL },
};

export default {
  PERMISSIONS,
  APP_PERMISSIONS,
  RESOURCE_PERMISSIONS,
  BUTTON_PERMISSIONS,
  ROUTE_PERMISSIONS,
};
