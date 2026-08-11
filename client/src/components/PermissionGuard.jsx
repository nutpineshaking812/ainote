import React from 'react';
import EmptyPage from './EmptyPage';
import { useAppResources } from '../pages/app-detail/context/AppResourcesContext';

/**
 * PermissionGuard - 权限守卫组件
 * 
 * 用于包裹需要特定权限才能访问的内容。
 * 如果用户没有所需权限，显示fallback内容，并且不渲染children（避免不必要的数据加载）
 * 
 * @param {string|string[]} require - 必需的权限（单个或数组）
 * @param {ReactNode} children - 有权限时渲染的内容
 * @param {ReactNode} fallback - 无权限时显示的内容
 * @param {string} fallbackMessage - 无权限时的默认提示文本
 */
export default function PermissionGuard({ 
  require: requiredPermission, 
  children, 
  fallback,
  fallbackMessage = '你没有访问权限'
}) {
  const { hasAppPermission } = useAppResources();

  // 检查权限
  const hasPermission = Array.isArray(requiredPermission)
    ? requiredPermission.some(perm => hasAppPermission(perm))
    : hasAppPermission(requiredPermission);

  // 如果没有权限，显示fallback或默认提示
  if (!hasPermission) {
    return fallback || (
      <div style={{ maxWidth: 1100, padding: 16, width: '100%' }}>
        <EmptyPage description={fallbackMessage} />
      </div>
    );
  }

  // 有权限时才渲染children（这样children中的副作用才会执行）
  return <>{children}</>;
}
