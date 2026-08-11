import { useMemo } from 'react';
import { usePermission } from './usePermission';

/**
 * 权限状态 Hook
 * 用于在组件中批量检查多个权限，返回权限状态对象
 *
 * 用法示例：
 * const can = usePermissionState({
 *   createApp: { permission: 'APP_CREATE', scope: 'org' },
 *   deleteApp: { permission: 'APP_DELETE', scope: 'org' },
 *   manageApp: { permission: 'MANAGE', scope: 'app' },
 *   viewData: { permission: 'VIEW', scope: 'app' }
 * });
 *
 * // 使用
 * {can.createApp && <Button>新建应用</Button>}
 * {can.deleteApp && <Button>删除应用</Button>}
 * {can.manageApp && <Button>编辑</Button>}
 */
export const usePermissionState = (permissions = {}) => {
  const { hasOrgPermission, hasAppPermission, hasResourcePermission } = usePermission();

  return useMemo(() => {
    const state = {};

    Object.entries(permissions).forEach(([key, config]) => {
      const { permission, scope = 'app', resource = null, userId = null } = config;

      if (scope === 'resource' && resource) {
        state[key] = hasResourcePermission(resource, permission, userId);
      } else if (scope === 'org') {
        state[key] = hasOrgPermission(permission);
      } else {
        state[key] = hasAppPermission(permission);
      }
    });

    return state;
  }, [permissions, hasOrgPermission, hasAppPermission, hasResourcePermission]);
};

export default usePermissionState;
