import React from 'react';
import { usePermission } from '../hooks/usePermission';

/**
 * 声明式权限组件
 *
 * 用法示例：
 * 1. 单个权限检查：
 *    <Permission require="APP_CREATE" scope="org">
 *      <Button>新建应用</Button>
 *    </Permission>
 *
 * 2. 满足任一权限：
 *    <Permission requireAny={['MANAGE', 'VIEW']} scope="app">
 *      <DataTable />
 *    </Permission>
 *
 * 3. 必须满足所有权限：
 *    <Permission requireAll={['MANAGE', 'ORG_MANAGE']} scope="org">
 *      <AdminPanel />
 *    </Permission>
 *
 * 4. 资源级权限：
 *    <Permission require="EDIT" scope="resource" resource={document}>
 *      <Button>编辑文档</Button>
 *    </Permission>
 *
 * 5. 无权限时显示替代内容：
 *    <Permission require="MANAGE" fallback={<Empty description="无权限" />}>
 *      <EditForm />
 *    </Permission>
 */
export const Permission = ({
  children,
  require = null, // 单个权限
  requireAny = [], // 满足任一权限
  requireAll = [], // 满足所有权限
  scope = 'app', // 'org' | 'app' | 'resource'
  resource = null, // 资源对象（用于资源级权限）
  userId = null, // 用户 ID（用于资源级权限）
  fallback = null, // 无权限时显示的内容
  loadingFallback = null, // 加载中显示的内容
  onUnauthorized = null, // 无权限时的回调
}) => {
  const { hasOrgPermission, hasAppPermission, hasResourcePermission, loading } = usePermission();

  // 加载中处理
  if (loading) {
    return loadingFallback;
  }

  let hasPermission = false;

  // 资源级权限检查
  if (scope === 'resource' && resource) {
    if (require) {
      hasPermission = hasResourcePermission(resource, require, userId);
    }
  }
  // 组织级权限检查
  else if (scope === 'org') {
    if (require) {
      hasPermission = hasOrgPermission(require);
    } else if (requireAny.length > 0) {
      hasPermission = requireAny.some((p) => hasOrgPermission(p));
    } else if (requireAll.length > 0) {
      hasPermission = requireAll.every((p) => hasOrgPermission(p));
    }
  }
  // 应用级权限检查
  else {
    if (require) {
      hasPermission = hasAppPermission(require);
    } else if (requireAny.length > 0) {
      hasPermission = requireAny.some((p) => hasAppPermission(p));
    } else if (requireAll.length > 0) {
      hasPermission = requireAll.every((p) => hasAppPermission(p));
    }
  }

  // 无权限处理
  if (!hasPermission) {
    if (onUnauthorized) {
      onUnauthorized();
    }
    return fallback;
  }

  return <>{children}</>;
};

export default Permission;
