import { useOrg } from '../store/OrgContext.jsx';

/**
 * Permission gate component
 * Only renders children if user has the required permission(s)
 *
 * @param {String|Array} permission - Single permission or array of permissions
 * @param {Boolean} requireAll - If true, requires all permissions (AND logic). Default is false (OR logic)
 * @param {ReactNode} children - Content to render if permission check passes
 * @param {ReactNode} fallback - Optional content to render if permission check fails
 */
export default function PermissionGate({
  permission,
  requireAll = false,
  children,
  fallback = null,
}) {
  const { hasPermission, hasAnyPermission, permissions } = useOrg();

  // If permissions haven't loaded yet, don't render anything
  if (!permissions) {
    return fallback;
  }

  let hasAccess = false;

  if (Array.isArray(permission)) {
    if (requireAll) {
      // AND logic: user must have ALL permissions
      hasAccess = permission.every((perm) => hasPermission(perm));
    } else {
      // OR logic: user must have ANY permission
      hasAccess = hasAnyPermission(permission);
    }
  } else {
    // Single permission check
    hasAccess = hasPermission(permission);
  }

  return hasAccess ? children : fallback;
}
