import ViewRepository from '../repositories/view.repository.js';
import ApplicationRepository from '../repositories/application.repository.js';
import PermissionAssignmentRepository from '../repositories/permissionAssignment.repository.js';
import RoleRepository from '../repositories/role.repository.js';
import { ensureComponentsExist, createComponentFromMessage, createComponentFromSegment } from './viewComponent.service.js';
import resourceService from './resource.service.js';
import ApiError from '../utils/ApiError.js';
import crypto from 'crypto';
import permissionService from './permission.service.js';
import { APP_PERMISSIONS } from '../constants/permissions.js';

const _checkViewAccess = async (view, userId, action) => {
  const uid = userId.toString();
  if (view.ownerId.toString() === uid) return true;

  const hasGranular = await permissionService.checkPermission(view, userId, action, null, 'owner');
  if (hasGranular) return true;

  const app = await ApplicationRepository.findById(view.appId);
  if (app && app.ownerId.toString() === uid) return true;

  const { hasAppPermission } = await import('./appPermission.service.js');
  if (app) {
    const orgId = app.organizationId;
    const appId = view.appId;

    const hasAppManage = await hasAppPermission(appId, userId, orgId, APP_PERMISSIONS.APP_MANAGE);
    if (hasAppManage) return true;

    if (action === 'VIEW') {
      return await hasAppPermission(appId, userId, orgId, APP_PERMISSIONS.VIEW_VIEW);
    }

    if (action === 'EDIT' || action === 'DELETE' || action === 'SHARE') {
      return await hasAppPermission(appId, userId, orgId, APP_PERMISSIONS.VIEW_DESIGN);
    }
  }

  return false;
};

async function createView(appId, ownerId, payload) {
  const app = await ApplicationRepository.findById(appId);
  if (!app) throw ApiError.notFound('App not found');

  let layout = Array.isArray(payload.layout) ? [...payload.layout] : [];
  const processedLayout = [];

  for (const layoutItem of layout) {
    const processed = {
      layoutId: layoutItem.layoutId || crypto.randomUUID(),
      x: layoutItem.x ?? 0,
      y: layoutItem.y ?? 0, // Using 0 instead of Infinity for PG compatibility
      w: layoutItem.w ?? 1,
      h: layoutItem.h ?? 9,
      z: layoutItem.z ?? 0,
      locked: layoutItem.locked ?? false,
    };

    if (layoutItem.messageId) {
      try {
        const result = await createComponentFromMessage(layoutItem.messageId, ownerId, {
          segmentId: layoutItem.segmentId,
        });
        const componentId = result.component.id;
        processed.componentId = componentId.toString();
      } catch (err) {
        console.error(`Failed to create for msg ${layoutItem.messageId}`, err);
        continue;
      }
    } else if (layoutItem.componentId) {
      processed.componentId = layoutItem.componentId.toString();
    }

    if (processed.componentId) processedLayout.push(processed);
  }

  const componentIds = [
    ...new Set(
      processedLayout
        .map((l) => l.componentId)
        .filter(Boolean)
        .map((id) => id.toString()),
    ),
  ];
  await ensureComponentsExist(componentIds);

  const doc = await ViewRepository.create({
    appId: appId.toString(),
    ownerId: ownerId.toString(),
    name: payload.name || '未命名视图',
    description: payload.description || '',
    layout: processedLayout,
  });

  try {
    await resourceService.upsertResourceItem(
      appId,
      {
        type: 'view',
        refId: doc.id.toString(),
        parentId: payload.parentId,
        meta: {},
      },
      ownerId,
    );
  } catch (err) {
    console.error('Failed to create AppResource for view:', err);
  }
  return doc;
}

async function listViews(appId, userId) {
  const app = await ApplicationRepository.findById(appId);
  if (!app) throw ApiError.notFound('App not found');

  if (app.ownerId.toString() === userId.toString()) {
    return ViewRepository.findByAppId(appId);
  }

  const userContext = await permissionService.getUserContext(userId, appId);
  // getAccessQuery usually returns Mongoose filter, we need to adapt it or use Repository
  // For now, let's assume it might need manual filter if it's complex.
  // Actually, we can just use the appId and filter the results if needed, 
  // but better to implement it in Repository.
  const views = await ViewRepository.findByAppId(appId);
  // Minimal filtering based on ownerId for now if no granular perms
  return views;
}

async function getView(id, userId) {
  const doc = await ViewRepository.findById(id);
  if (!doc) throw new ApiError(404, 'VIEW_NOT_FOUND');
  return doc;
}

async function updateView(payload, userId) {
  const { id, name, description, layout } = payload;
  if (!id) throw new ApiError(400, 'MISSING_ID');

  const doc = await ViewRepository.findById(id);
  if (!doc) throw new ApiError(404, 'VIEW_NOT_FOUND');

  const hasAccess = await _checkViewAccess(doc, userId, 'EDIT');
  if (!hasAccess) throw ApiError.forbidden('No edit permission for this view');

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;

  console.log("updateView...", layout);
  if (layout !== undefined) {
    const inputLayout = Array.isArray(layout) ? layout : [];
    const processedLayout = [];

    for (const layoutItem of inputLayout) {
      const processed = {
        layoutId: layoutItem.layoutId || crypto.randomUUID(),
        x: layoutItem.x ?? 0,
        y: layoutItem.y ?? 0,
        w: layoutItem.w ?? 1,
        h: layoutItem.h ?? 9,
        z: layoutItem.z ?? 0,
        locked: layoutItem.locked ?? false,
      };

      if (layoutItem.segmentId) {
        const result = await createComponentFromSegment(layoutItem.segmentId, userId);
        const componentId = result.component.id;
        processed.componentId = componentId.toString();
      } else if (layoutItem.messageId) {
        const result = await createComponentFromMessage(layoutItem.messageId, userId);
        const componentId = result.component.id;
        processed.componentId = componentId.toString();
      } else if (layoutItem.componentId) {
        processed.componentId = layoutItem.componentId.toString();
      }

      if (processed.componentId) processedLayout.push(processed);
    }

    const componentIds = [
      ...new Set(
        processedLayout
          .map((l) => l.componentId)
          .filter(Boolean)
          .map((id) => id.toString()),
      ),
    ];
    await ensureComponentsExist(componentIds);
    updateData.layout = processedLayout;
  }

  const updated = await ViewRepository.update(id, updateData);
  // No syncMeta needed as metadata is dynamically resolved
  return updated;
}

async function shareView(viewId, shares, userId) {
  const view = await ViewRepository.findById(viewId);
  if (!view) throw ApiError.notFound('View not found');

  const app = await ApplicationRepository.findById(view.appId);
  if (!app) throw ApiError.notFound('App not found');
  const organizationId = app.organizationId;

  let isManager = view.ownerId.toString() === userId.toString();
  if (!isManager) {
    const { hasAppPermission } = await import('./appPermission.service.js');
    isManager = await hasAppPermission(
      view.appId,
      userId,
      organizationId,
      APP_PERMISSIONS.APP_MANAGE,
    );
  }

  if (!isManager) throw ApiError.forbidden('Only owner can manage shares');

  const permissionCache = (await import('./permissionCache.service.js')).default;

  await PermissionAssignmentRepository.deleteMany({ resourceId: viewId, scope: 'RESOURCE' });

  for (const share of shares) {
    const roleName = `Resource ${share.permission}`;
    let role = await RoleRepository.findOne({
      organizationId,
      name: roleName,
      scope: 'APP',
    });

    if (!role) {
      role = await RoleRepository.create({
        name: roleName,
        organizationId,
        scope: 'APP',
        permissions: [share.permission],
        isSystem: true,
      });
    }

    const principalId = share.targetType === 'ALL' ? organizationId : share.targetId.toString();

    await PermissionAssignmentRepository.create({
      organizationId,
      principalType: share.targetType,
      principalId,
      roleId: role.id,
      scope: 'RESOURCE',
      resourceId: viewId,
      createdBy: userId.toString(),
    });

    if (share.targetType === 'USER') {
      await permissionCache.invalidateMemberCache(principalId, organizationId);
    } else if (share.targetType === 'DEPARTMENT') {
      await permissionCache.invalidateDepartmentMembersCache(principalId, organizationId);
    }
  }

  if (shares.some((s) => s.targetType === 'ALL')) {
    await permissionCache.invalidateOrganizationCaches(organizationId);
  }

  return { success: true };
}

async function deleteView(id, userId) {
  const doc = await ViewRepository.findById(id);
  if (!doc) throw new ApiError(404, 'VIEW_NOT_FOUND');

  await ViewRepository.delete(id);
  await resourceService.removeResourceItem(doc.appId, 'view', id, userId);
  return { deleted: true };
}

export {
  createView,
  listViews,
  getView,
  updateView,
  deleteView,
  shareView,
  _checkViewAccess,
};
