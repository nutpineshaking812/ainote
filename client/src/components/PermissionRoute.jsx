import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { usePermission } from '../hooks/usePermission';
import { Result, Button } from 'antd';
import { LockOutlined } from '@ant-design/icons';

/**
 * 权限路由守卫组件
 * 用于保护需要特定权限才能访问的路由
 *
 * 用法：
 * <Route path="/admin/organization" element={
 *   <PermissionRoute requiredPermission="ORG_MANAGE" scope="org">
 *     <OrgSettingsPage />
 *   </PermissionRoute>
 * } />
 */
export const PermissionRoute = ({
  children,
  requiredPermission,
  requireAny = [],
  requireAll = [],
  scope = 'app',
  redirectTo = null,
  showForbidden = true,
}) => {
  const { hasOrgPermission, hasAppPermission, loading } = usePermission();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        <Result status="info" title="正在检查权限..." />
      </div>
    );
  }

  const scopes = Array.isArray(scope) ? scope : [scope];

  const hasPermission = scopes.some((s) => {
    const checkFn = s === 'org' ? hasOrgPermission : hasAppPermission;

    if (requiredPermission) {
      return checkFn(requiredPermission);
    }
    if (requireAny.length > 0) {
      return requireAny.some((p) => checkFn(p));
    }
    if (requireAll.length > 0) {
      return requireAll.every((p) => checkFn(p));
    }
    return false;
  });

  if (!hasPermission) {
    if (showForbidden) {
      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: '#f5f5f5',
          }}
        >
          <Result
            status="403"
            title="403"
            subTitle="抱歉，您没有权限访问此页面"
            icon={<LockOutlined style={{ fontSize: 72, color: '#ff4d4f' }} />}
            extra={
              <Button type="primary" onClick={() => navigate(-1)}>
                返回上一页
              </Button>
            }
          />
        </div>
      );
    }

    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }

    return null;
  }

  return children;
};

export default PermissionRoute;
