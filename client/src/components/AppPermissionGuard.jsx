import React from 'react';
import { useParams, Outlet } from 'react-router-dom';
import { AppPermissionProvider } from '../context/AppPermissionContext';

/**
 * AppPermissionGuard
 * 自动从 URL 中提取 appId 并提供 AppPermissionProvider
 * 用于包裹在 App.jsx 中需要应用权限检查的路由
 */
const AppPermissionGuard = ({ children }) => {
  const { appId } = useParams();

  return <AppPermissionProvider appId={appId}>{children || <Outlet />}</AppPermissionProvider>;
};

export default AppPermissionGuard;
