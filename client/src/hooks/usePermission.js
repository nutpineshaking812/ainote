import { useMemo } from 'react';
import { useOrg } from '../store/OrgContext';
import { useAppPermissions } from '../context/AppPermissionContext';
import { APP_PERMISSIONS, RESOURCE_PERMISSIONS } from '../constants/permissions';
import { useAuth } from '../store/AuthContext';

/**
 * 权限检查 Hook
 *
 * 使用示例：
 * const { hasOrgPermission, hasAppPermission, hasResourcePermission } = usePermission();
 *
 * if (hasOrgPermission('APP_CREATE')) {
 *   // 显示创建应用按钮
 * }
 */
export const usePermission = (appId = null, appPermissions = null) => {
  const { currentOrganization, permissions: orgPermissions, loading: orgLoading } = useOrg();
  const { appPermissions: contextAppPermissions, loading: appLoading } = useAppPermissions();
  const { user } = useAuth();

  const isLoading = orgLoading || appLoading;

  // 使用传入的 appPermissions 或从 context 获取
  const effectiveAppPermissions = appPermissions || contextAppPermissions || [];

  /**
   * 检查组织级权限
   * @param {string} permission - 权限标识，如 'APP_CREATE', 'MEMBER_MANAGE'
   * @returns {boolean}
   */
  const hasOrgPermission = useMemo(() => {
    return (permission) => {
      if (isLoading || !currentOrganization || !orgPermissions) return false;

      // 组织 Owner 拥有所有权限
      if (currentOrganization.ownerId === user?.id) {
        return true;
      }

      return orgPermissions.includes(permission);
    };
  }, [isLoading, currentOrganization, orgPermissions, user]);

  /**
   * 检查应用级权限
   * @param {string} permission - 权限标识，如 'MANAGE', 'VIEW', 'FILL'
   * @param {Array} permissions - 可选，直接传入权限数组
   * @returns {boolean}
   */
  const hasAppPermission = useMemo(() => {
    return (permission, permissions = effectiveAppPermissions) => {
      if (isLoading || !permissions || permissions.length === 0) return false;

      // 1. app:manage 包含所有其他权限
      if (permissions.includes(APP_PERMISSIONS.APP_MANAGE)) {
        return true;
      }

      // 2. 显式权限匹配
      if (permissions.includes(permission)) {
        return true;
      }

      // 视图设计权限 (view:design) -> 包含查看(view)
      // if (permission === APP_PERMISSIONS.VIEW_VIEW) {
      //   if (permissions.includes(APP_PERMISSIONS.VIEW_DESIGN)) return true;
      // }

      // // 基础访问权限处理
      // if (permission === APP_PERMISSIONS.FORM_VIEW || permission === APP_PERMISSIONS.VIEW_VIEW) {
      //   if (permissions.includes(APP_PERMISSIONS.APP_VIEW)) return true;
      // }

      return false;
    };
  }, [isLoading, effectiveAppPermissions]);

  /**
   * 检查资源级权限
   * @param {Object} resource - 资源对象，包含 shares 字段
   * @param {string} permission - 权限标识，如 'VIEW', 'EDIT'
   * @param {string} userId - 当前用户 ID
   * @returns {boolean}
   */
  const hasResourcePermission = useMemo(() => {
    return (resource, permission, userId = user?.id) => {
      if (!resource || !userId) return false;

      const currentUserId = userId?.toString();

      // 1. 资源创建者拥有所有权限
      const ownerId = (resource.owner?._id || resource.owner?.id || resource.owner)?.toString();
      if (ownerId === currentUserId) {
        return true;
      }

      // 2. 检查应用级权限（向下兼容：拥有应用级全局权限则拥有所有具体资源的对应权限）
      if (hasAppPermission(permission)) {
        return true;
      }

      // 3. 检查资源自身的分享配置 (resource.shares)
      if (!resource.shares || resource.shares.length === 0) {
        return false;
      }

      // 查找该用户的分享记录
      const userShare = resource.shares.find((share) => {
        const targetId = (share.targetId?._id || share.targetId?.id || share.targetId)?.toString();
        if (share.targetType === 'USER' && targetId === currentUserId) {
          return true;
        }
        // TODO: 支持 DEPARTMENT 和 ROLE 类型的检查逻辑
        return false;
      });

      if (!userShare) return false;

      // 4. 权限等级推导 (资源级分享持有的权限)
      const granted = userShare.permission;

      // 4.1 相同权限直接准许
      if (granted === permission) return true;

      // 4.2 EDIT 包含 VIEW (通用资源级逻辑)
      if (permission === RESOURCE_PERMISSIONS.VIEW && granted === RESOURCE_PERMISSIONS.EDIT) {
        return true;
      }

      // 4.3 表单 granular 权限继承 (资源级分享可能持有 design 权限)
      if (
        permission === APP_PERMISSIONS.FORM_VIEW ||
        permission === APP_PERMISSIONS.FORM_FILL ||
        permission === APP_PERMISSIONS.FORM_EXPORT
      ) {
        if (granted === APP_PERMISSIONS.FORM_DESIGN) return true;
      }

      // 4.4 视图 granular 权限继承
      if (permission === APP_PERMISSIONS.VIEW_VIEW) {
        if (granted === APP_PERMISSIONS.VIEW_DESIGN) return true;
      }

      return false;
    };
  }, [hasAppPermission, user]);

  /**
   * 检查是否是应用创建者
   * @param {Object} app - 应用对象
   * @param {string} userId - 用户 ID
   * @returns {boolean}
   */
  const isAppOwner = useMemo(() => {
    return (app, userId = user?.id) => {
      if (!app || !userId) return false;
      return app.owner === userId || app.owner?._id === userId || app.owner?.id === userId;
    };
  }, [user]);

  /**
   * 检查是否是组织 Owner
   * @param {string} userId - 用户 ID
   * @returns {boolean}
   */
  const isOrgOwner = useMemo(() => {
    return (userId = user?.id) => {
      if (!currentOrganization || !userId) return false;
      return currentOrganization.ownerId === userId;
    };
  }, [currentOrganization, user]);

  /**
   * 批量检查权限（至少拥有其中一个）
   * @param {Array<string>} permissions - 权限数组
   * @param {string} scope - 'org' | 'app'
   * @returns {boolean}
   */
  const hasAnyPermission = useMemo(() => {
    return (permissions, scope = 'app') => {
      if (!permissions || permissions.length === 0) return false;

      const scopes = Array.isArray(scope) ? scope : [scope];
      return scopes.some((s) => {
        const checkFn = s === 'org' ? hasOrgPermission : hasAppPermission;
        return permissions.some((p) => checkFn(p));
      });
    };
  }, [hasOrgPermission, hasAppPermission]);

  /**
   * 批量检查权限（必须全部拥有）
   * @param {Array<string>} permissions - 权限数组
   * @param {string|string[]} scope - 'org' | 'app' | ['org', 'app']
   * @returns {boolean}
   */
  const hasAllPermissions = useMemo(() => {
    return (permissions, scope = 'app') => {
      if (!permissions || permissions.length === 0) return true;

      const scopes = Array.isArray(scope) ? scope : [scope];
      return scopes.some((s) => {
        const checkFn = s === 'org' ? hasOrgPermission : hasAppPermission;
        return permissions.every((p) => checkFn(p));
      });
    };
  }, [hasOrgPermission, hasAppPermission]);

  return {
    hasOrgPermission,
    hasAppPermission,
    hasResourcePermission,
    isAppOwner,
    isOrgOwner,
    hasAnyPermission,
    hasAllPermissions,
    loading: isLoading,
  };
};

export default usePermission;
