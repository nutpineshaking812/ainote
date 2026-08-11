import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMyAppPermissions } from '../api/apps';

const AppPermissionContext = createContext(null);

/**
 * 应用权限 Context Provider
 * 用于管理当前应用的权限数据
 *
 * 用法：
 * <AppPermissionProvider appId={appId}>
 *   <YourComponent />
 * </AppPermissionProvider>
 */
export const AppPermissionProvider = ({ children, appId }) => {
  const [appPermissions, setAppPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!appId) {
      setAppPermissions([]);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getMyAppPermissions(appId);
        setAppPermissions(data || []);
      } catch (err) {
        console.error('Failed to fetch app permissions:', err);
        setError(err);
        setAppPermissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [appId]);

  const value = {
    appPermissions,
    loading,
    error,
    refreshPermissions: () => {
      if (appId) {
        getMyAppPermissions(appId).then((data) => {
          setAppPermissions(data || []);
        });
      }
    },
  };

  return <AppPermissionContext.Provider value={value}>{children}</AppPermissionContext.Provider>;
};

/**
 * Hook to access app permissions
 * Must be used within AppPermissionProvider
 */
export const useAppPermissions = () => {
  const context = useContext(AppPermissionContext);
  // 如果不在 AppPermissionProvider 内部，返回默认值而不是抛出错误
  // 这样可以在非应用页面中使用 usePermission hook
  if (!context) {
    return { appPermissions: [], loading: false, error: null };
  }
  return context;
};

export default AppPermissionContext;
