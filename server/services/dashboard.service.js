import UserDashboardRepository from '../repositories/userDashboard.repository.js';
import OrgWidgetRepository from '../repositories/orgWidget.repository.js';
import ApplicationRepository from '../repositories/application.repository.js';
import { ApiError } from '../utils/ApiError.js';

import DocumentRepository from '../repositories/document.repository.js';
import OrganizationMemberRepository from '../repositories/organizationMember.repository.js';

// Helper to enrich items with referenced resource fields (name/title/icon)
async function enrich(items, organizationId, accessibleAppIds) {
  if (!items.length) return [];
  const appIds = items.filter((i) => i.refType === 'Application').map((i) => i.refId);
  const docIds = items.filter((i) => i.refType === 'Document').map((i) => i.refId);

  // If accessibleAppIds not provided, fetch them
  if (!accessibleAppIds) {
    const { getAccessibleAppIds } = await import('./appPermission.service.js');
    // We don't have userId here easily if not passed...
    // Actually, this function is internal helper. The caller should provide it.
    // However, to fix the bug in listFavorites/listRecents, we handle it there.
    // Here we assume accessibleAppIds is provided.
    // If not, we might be filtering everything or nothing.
    // Let's assume strict requirement.
    return [];
  }

  // Filter appIds to only those the user has access to in this organization
  const filteredAppIds = appIds.filter((id) => accessibleAppIds.includes(id.toString()));

  const [apps, docs] = await Promise.all([
    filteredAppIds.length
      ? ApplicationRepository.find({
          organizationId: organizationId.toString(),
        }).then((list) => list.filter((a) => filteredAppIds.includes(a.id)))
      : Promise.resolve([]),
    docIds.length
      ? DocumentRepository.findAll({
          where: (t, d) =>
            d.and(
              d.inArray(
                t.id,
                docIds.map((id) => id.toString()),
              ),
              d.inArray(
                t.appRef,
                (accessibleAppIds || []).map((id) => id.toString()),
              ),
            ),
        })
      : Promise.resolve([]),
  ]);

  const appMap = {};
  apps.forEach((a) => {
    appMap[a.id] = a;
  });
  const docMap = {};
  docs.forEach((d) => {
    docMap[d.id] = d;
  });

  return items
    .map((i) => {
      const out = {
        id: i.refId,
        refId: i.refId,
        refType: i.refType,
        itemType: i.itemType,
        addedAt: i.addedAt,
        lastUsedAt: i.lastUsedAt,
      };
      if (i.refType === 'Application') {
        const a = appMap[i.refId.toString()];
        if (!a) return null;
        Object.assign(out, { name: a.name, icon: a.icon, iconColor: a.iconColor });
      } else if (i.refType === 'Document') {
        const d = docMap[i.refId.toString()];
        if (!d) return null;
        Object.assign(out, { title: d.title, updatedAt: d.updatedAt, appId: d.appRef });
      }
      return out;
    })
    .filter(Boolean);
}

// Raw fetch functions
async function listFavoritesRaw(userId, organizationId) {
  return await UserDashboardRepository.findByUserAndOrg(userId, organizationId, 'favorite');
}

async function listRecentsRaw(userId, organizationId) {
  return await UserDashboardRepository.findByUserAndOrg(userId, organizationId, 'recent');
}

async function listFavorites(userId, organizationId, accessibleAppIds) {
  if (!accessibleAppIds) {
    const { getAccessibleAppIds } = await import('./appPermission.service.js');
    accessibleAppIds = await getAccessibleAppIds(userId, organizationId);
  }
  const rows = await listFavoritesRaw(userId, organizationId);
  return enrich(rows, organizationId, accessibleAppIds);
}

async function listRecents(userId, organizationId, accessibleAppIds) {
  if (!accessibleAppIds) {
    const { getAccessibleAppIds } = await import('./appPermission.service.js');
    accessibleAppIds = await getAccessibleAppIds(userId, organizationId);
  }
  const rows = await listRecentsRaw(userId, organizationId);
  return enrich(rows, organizationId, accessibleAppIds);
}

async function toggleFavorite(userId, organizationId, refType, refId, on) {
  if (on) {
    await UserDashboardRepository.upsertItem(userId, organizationId, {
      itemType: 'favorite',
      refType,
      refId: refId.toString(),
      addedAt: new Date(),
    });
    // Trim favorites beyond 10 (newest kept)
    await UserDashboardRepository.trimItems(userId, organizationId, 'favorite', refType, 10);
  } else {
    // We need to find the specific item to delete by type and refId
    const items = await UserDashboardRepository.findAll({
      where: (t, { eq, and }) => and(
        eq(t.userId, userId),
        eq(t.organizationId, organizationId.toString()),
        eq(t.itemType, 'favorite'),
        eq(t.refType, refType),
        eq(t.refId, refId.toString())
      )
    });
    if (items.length) {
      await Promise.all(items.map(i => UserDashboardRepository.delete(i.id)));
    }
  }
}

async function touchRecent(userId, organizationId, refType, refId) {
  await UserDashboardRepository.upsertItem(userId, organizationId, {
    itemType: 'recent',
    refType,
    refId: refId.toString(),
    lastUsedAt: new Date(),
    addedAt: new Date() // Fallback if new
  });
  
  // Category-specific trimming: Applications -> 10, Documents -> 3
  if (refType === 'Application') {
    await UserDashboardRepository.trimItems(userId, organizationId, 'recent', 'Application', 10);
  } else if (refType === 'Document') {
    await UserDashboardRepository.trimItems(userId, organizationId, 'recent', 'Document', 3);
  }
}

async function setDashboardView(userId, organizationId, dashboardViewData) {
  if (!dashboardViewData || !Array.isArray(dashboardViewData)) {
    throw ApiError.badRequest(
      'Invalid dashboard view data. Requires a layout array.',
      'INVALID_VIEW_DATA',
    );
  }

  await UserDashboardRepository.upsertItem(userId, organizationId, {
    itemType: 'views',
    refType: 'View',
    refId: 'default', // placeholder for views item
    views: dashboardViewData
  });
}

// Add these functions below setDashboardView
async function addLayoutComponent(userId, organizationId, layoutComponentData) {
  console.log('addLayoutComponent called with:', layoutComponentData);
  if (
    !layoutComponentData ||
    !layoutComponentData.layoutId ||
    !layoutComponentData.componentId ||
    !layoutComponentData.appId ||
    !layoutComponentData.owner
  ) {
    throw ApiError.badRequest('Invalid layout component data', 'INVALID_LAYOUT_COMPONENT_DATA');
  }

  await UserDashboardRepository.appendView(userId, organizationId, layoutComponentData);
  return { message: 'Layout component added successfully' };
}

async function deleteLayoutComponent(userId, organizationId, layoutId) {
  if (!layoutId) {
    throw ApiError.badRequest('Layout ID is required', 'LAYOUT_ID_REQUIRED');
  }

  const existing = await UserDashboardRepository.findOne({
    where: (t, { eq, and }) => and(
      eq(t.userId, userId),
      eq(t.organizationId, organizationId.toString()),
      eq(t.itemType, 'views')
    )
  });

  if (!existing) {
    throw ApiError.notFound('Dashboard view not found for user', 'DASHBOARD_VIEW_NOT_FOUND');
  }

  const newViews = (existing.views || []).filter(v => v.layoutId !== layoutId);
  if (newViews.length === existing.views.length) {
    throw ApiError.notFound('Layout component not found', 'LAYOUT_COMPONENT_NOT_FOUND');
  }

  await UserDashboardRepository.update(existing.id, { views: newViews });
  return { message: 'Layout component deleted successfully' };
}

// Summary aggregation combining favorites, recent apps, and recent documents
async function getDashboardSummary(userId, organizationId) {
  if (!organizationId) {
    throw ApiError.badRequest('Organization ID is required', 'ORG_ID_REQUIRED');
  }

  const { getAccessibleAppIds } = await import('./appPermission.service.js');

  // Execute independent tasks in parallel
  const [accessibleAppIds, member, favoritesRaw, recentsRaw, dashboardViewItem, allOrgWidgets] =
    await Promise.all([
      getAccessibleAppIds(userId, organizationId),
      OrganizationMemberRepository.findOne(userId, organizationId),
      listFavoritesRaw(userId, organizationId),
      listRecentsRaw(userId, organizationId),
      UserDashboardRepository.findOne({
        where: (t, { eq, and }) => and(
          eq(t.userId, userId),
          eq(t.organizationId, organizationId.toString()),
          eq(t.itemType, 'views')
        )
      }),
      OrgWidgetRepository.findByOrg(organizationId, 'ACTIVE'),
    ]);

  const userRoleIds = (member?.roleIds || []).map((id) => id.toString());
  const userDeptIds = (member?.departmentIds || []).map((id) => id.toString());

  // Batch enrich favorites and recents
  const enrichedItems = await enrich(
    [...favoritesRaw, ...recentsRaw],
    organizationId,
    accessibleAppIds,
  );

  // Split back into favorites and recents
  // Note: enrich filters items, so counts may change.
  // We need to match enriched items back to their source or just filter the enriched list.
  // Since we need separate lists for return, filtering the combined enriched list by itemType/refType is easiest if we preserve properties.
  // Enriched items still have itemType ('favorite' or 'recent').

  const favorites = enrichedItems.filter((i) => i.itemType === 'favorite');
  const enrichedRecents = enrichedItems.filter((i) => i.itemType === 'recent');

  const recentApps = enrichedRecents.filter((r) => r.refType === 'Application');
  const recentDocuments = enrichedRecents.filter((r) => r.refType === 'Document');

  // Filter widgets by visibility
  const orgWidgets = allOrgWidgets.filter((w) => {
    // If neither roles nor departments specified, it's visible to everyone
    const hasRoleLimit = w.visibleToRoles && w.visibleToRoles.length > 0;
    const hasDeptLimit = w.visibleToDepartments && w.visibleToDepartments.length > 0;

    if (!hasRoleLimit && !hasDeptLimit) return true;

    // Check role match
    const roleMatch =
      hasRoleLimit && w.visibleToRoles.some((roleId) => userRoleIds.includes(roleId.toString()));
    // Check department match
    const deptMatch =
      hasDeptLimit &&
      w.visibleToDepartments.some((deptId) => userDeptIds.includes(deptId.toString()));

    return (roleMatch || deptMatch) ? { ...w, _id: w.id } : null;
  }).filter(Boolean);

  const dashboardView = (dashboardViewItem?.views || []).filter((v) =>
    accessibleAppIds.includes(v.appId?.toString()),
  );

  return { recentApps, favorites, recentDocuments, dashboardView, orgWidgets };
}

export default {
  listFavorites,
  listRecents,
  toggleFavorite,
  touchRecent,
  getDashboardSummary,
  setDashboardView,
  addLayoutComponent,
  deleteLayoutComponent,
};
