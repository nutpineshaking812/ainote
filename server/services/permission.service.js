import OrganizationMemberRepository from '../repositories/organizationMember.repository.js';
import ApplicationRepository from '../repositories/application.repository.js';
import permissionEngine from './permissionEngine.service.js';

/**
 * Get user context (roles and departments) within an app/organization.
 */
async function getUserContext(userId, appId) {
  if (!appId) return { roleIds: [], departmentIds: [] };

  const app = await ApplicationRepository.findById(appId);
  if (!app) return { roleIds: [], departmentIds: [] };

  const member = await OrganizationMemberRepository.findOne(userId, app.organizationId.toString());

  if (!member || member.status !== 'ACTIVE') return { roleIds: [], departmentIds: [] };

  return {
    roleIds: (member.roleIds || []).map((id) => id.toString()),
    departmentIds: (member.departmentIds || []).map((id) => id.toString()),
  };
}

/**
 * Build MongoDB query conditions for access control.
 */
function getAccessQuery(userId, userContext, ownerField = 'createdBy') {
  const { roleIds = [], departmentIds = [] } = userContext;

  const shareConditions = [
    { 'shares.targetType': 'ALL' },
    { 'shares.targetType': 'USER', 'shares.targetId': userId },
  ];

  if (roleIds.length > 0) {
    shareConditions.push({ 'shares.targetType': 'ROLE', 'shares.targetId': { $in: roleIds } });
  }

  if (departmentIds.length > 0) {
    shareConditions.push({
      'shares.targetType': 'DEPARTMENT',
      'shares.targetId': { $in: departmentIds },
    });
  }

  return {
    $or: [{ [ownerField]: userId }, { $or: shareConditions }],
  };
}

/**
 * Check if user has specific permission on a resource.
 */
async function checkPermission(
  resource,
  userId,
  action,
  userContext = null,
  ownerField = 'createdBy',
) {
  const ownerId = resource[ownerField]?.toString();
  if (ownerId && ownerId === userId.toString()) return true;

  let organizationId = resource.organizationId;
  if (!organizationId && (resource.appId || resource.appRef)) {
    const app = await ApplicationRepository.findById(resource.appId || resource.appRef);
    organizationId = app?.organizationId;
  }

  if (!organizationId) return false;

  const hasV2Access = await permissionEngine.hasPermission(
    userId,
    organizationId,
    resource._id || resource.id,
    action,
    'RESOURCE',
  );
  if (hasV2Access) return true;

  const shares = resource.shares || [];
  const { roleIds = [], departmentIds = [] } =
    userContext || (await getUserContext(userId, resource.appId || resource.appRef));

  for (const share of shares) {
    let match = false;
    if (share.targetType === 'ALL') match = true;
    else if (share.targetType === 'USER' && share.targetId.toString() === userId.toString())
      match = true;
    else if (share.targetType === 'ROLE' && roleIds.includes(share.targetId.toString()))
      match = true;
    else if (share.targetType === 'DEPARTMENT' && departmentIds.includes(share.targetId.toString()))
      match = true;

    if (match) {
      if (action === 'VIEW') return true;
      if (action === 'EDIT' && share.permission === 'EDIT') return true;
    }
  }

  return false;
}

export default {
  getUserContext,
  getAccessQuery,
  checkPermission,
};
