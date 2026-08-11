import { RESOURCE_TYPES } from '../constants/resources.js';
import crypto from 'crypto';
import { formRepository } from '../repositories/form.repository.js';
import ViewRepository from '../repositories/view.repository.js';
import { inArray } from 'drizzle-orm';
import { ApiError } from '../utils/ApiError.js';
import accessService from './access.service.js';
import { APP_PERMISSIONS } from '../constants/permissions.js';
import ResourceRepository from '../repositories/resource.repository.js';
import DocumentRepository from '../repositories/document.repository.js';
import ApplicationRepository from '../repositories/application.repository.js';
import OrganizationMemberRepository from '../repositories/organizationMember.repository.js';

/**
 * Get ordered resources for an application.
 * Only returns resources the user has permission to access.
 */
const resolveResourcesMetadata = async (items) => {
  if (!items || items.length === 0) return items;

  const docIds = [];
  const formIds = [];
  const viewIds = [];

  for (const it of items) {
    if (it.type === RESOURCE_TYPES.DOCUMENT) {
      docIds.push(it.refId.toString());
    } else if (it.type === RESOURCE_TYPES.FORM) {
      formIds.push(it.refId.toString());
    } else if (it.type === RESOURCE_TYPES.VIEW) {
      viewIds.push(it.refId.toString());
    }
  }

  const [docs, forms, views] = await Promise.all([
    docIds.length > 0
      ? DocumentRepository.findAll({
          where: (t) => inArray(t.id, docIds),
        })
      : Promise.resolve([]),
    formIds.length > 0
      ? formRepository.findAll({
          where: (t) => inArray(t.id, formIds),
        })
      : Promise.resolve([]),
    viewIds.length > 0
      ? ViewRepository.find({
          where: (t) => inArray(t.id, viewIds),
        })
      : Promise.resolve([]),
  ]);

  const docMap = new Map(docs.map((d) => [d.id.toString(), d]));
  const formMap = new Map(forms.map((f) => [f.id.toString(), f]));
  const viewMap = new Map(views.map((v) => [v.id.toString(), v]));

  return items.map((it) => {
    let resolvedMeta = null;
    if (it.type === RESOURCE_TYPES.FOLDER) {
      resolvedMeta = it.meta || { name: '新建文件夹', desc: '' };
    } else if (it.type === RESOURCE_TYPES.DOCUMENT) {
      const doc = docMap.get(it.refId.toString());
      const keys = [...(doc?.tags || [])];
      if (doc?.docType === 'ai_memory' || doc?.docType === 'ai_memory_archive') {
        if (!keys.includes('ai_memory')) {
          keys.push('ai_memory');
        }
      }
      resolvedMeta = {
        name: doc?.title || '未命名文档',
        desc: '',
        tags: doc?.tags || [],
        categoryKeys: keys,
        purpose: doc?.purpose || 'NORMAL',
        isSkill: doc?.purpose === 'SKILL',
        isKnowledge: doc?.purpose === 'KNOWLEDGE',
        skillName: doc?.skillName || '',
        skillDescription: doc?.description || '',
        skillParameters: doc?.parameters || {},
      };
    } else if (it.type === RESOURCE_TYPES.FORM) {
      const form = formMap.get(it.refId.toString());
      resolvedMeta = {
        name: form?.name || '未命名表单',
        desc: form?.description || '',
        tags: form?.tags || [],
      };
    } else if (it.type === RESOURCE_TYPES.VIEW) {
      const view = viewMap.get(it.refId.toString());
      resolvedMeta = {
        name: view?.name || '未命名视图',
        desc: view?.description || '',
      };
    }

    const baseMeta = it.meta || {};
    return {
      ...it,
      meta: resolvedMeta
        ? {
            ...baseMeta,
            ...resolvedMeta,
          }
        : {
            name: '未命名',
            desc: '',
            ...baseMeta,
          },
    };
  });
};

const getResources = async (appId, userId, parentId = null, options = {}) => {
  const { permissions } = options;
  await accessService.ensureAppAccess(appId, userId, permissions);

  const targetParentId = parentId || null;
  const items = await ResourceRepository.findByAppAndParent(appId, targetParentId);

  // Check children for leaf status
  const parentIdsWithChildren = await ResourceRepository.findParentIds(appId);
  const hasChildrenSet = new Set(parentIdsWithChildren);

  const resolvedItems = await resolveResourcesMetadata(items);

  const transformedItems = resolvedItems.map((it) => ({
    id: it.id,
    refId: it.refId,
    type: it.type,
    parentId: it.parentId,
    order: it.order,
    hidden: it.hidden,
    pinned: it.pinned,
    updatedAt: it.updatedAt,
    isLeaf:
      it.type === RESOURCE_TYPES.FOLDER
        ? false
        : it.type === RESOURCE_TYPES.DOCUMENT
          ? !hasChildrenSet.has(it.id)
          : true,
    meta: it.meta,
  }));

  const accessibleItems = await filterAccessibleResources(transformedItems, appId, userId, options);
  return { items: accessibleItems };
};

/**
 * Filter resources based on user permissions
 */
async function filterAccessibleResources(resources, appId, userId, options = {}) {
  if (!resources || resources.length === 0) return [];

  let { permissions, member, organizationId } = options;
  let context;
  if (member && organizationId) {
    context = {
      roleIds: (member.roleIds || []).map((id) => id.toString()),
      departmentIds: (member.departmentIds || []).map((id) => id.toString()),
      isAppOwner: false,
      organizationId,
      appId,
    };
  } else {
    context = await getUserContext(userId, appId);
    organizationId = context.organizationId;
  }

  if (!permissions) {
    const permissionEngine = (await import('./permissionEngine.service.js')).default;
    permissions = await permissionEngine.calculatePermissions(userId, organizationId);
  }

  const appIdStr = appId.toString();
  const appPerms = permissions?.apps[appIdStr] || [];

  if (appPerms.includes(APP_PERMISSIONS.APP_MANAGE)) {
    context.isAppOwner = true;
  } else if (!context.isAppOwner && member) {
    const app = await ApplicationRepository.findById(appId);
    if (app && app.owner.toString() === userId.toString()) {
      context.isAppOwner = true;
    }
  }

  const formIds = [];
  const viewIds = [];
  const docIds = [];

  for (const res of resources) {
    if (res.type === RESOURCE_TYPES.FORM) formIds.push(res.refId);
    else if (res.type === RESOURCE_TYPES.VIEW) viewIds.push(res.refId);
    else if (res.type === RESOURCE_TYPES.DOCUMENT) docIds.push(res.refId);
  }

  const [accessibleFormIds, accessibleViewIds, accessibleDocIds] = await Promise.all([
    formIds.length > 0
      ? getAccessibleFormIds(formIds, userId, context, permissions)
      : Promise.resolve([]),
    viewIds.length > 0
      ? getAccessibleViewIds(viewIds, userId, context, permissions)
      : Promise.resolve([]),
    docIds.length > 0
      ? getAccessibleDocumentIds(docIds, userId, context, permissions)
      : Promise.resolve([]),
  ]);

  const formSet = new Set(accessibleFormIds.map((id) => id.toString()));
  const viewSet = new Set(accessibleViewIds.map((id) => id.toString()));
  const docSet = new Set(accessibleDocIds.map((id) => id.toString()));

  return resources.filter((res) => {
    const refIdStr = res.refId.toString();
    if (res.type === RESOURCE_TYPES.FORM) return formSet.has(refIdStr);
    if (res.type === RESOURCE_TYPES.VIEW) return viewSet.has(refIdStr);
    if (res.type === RESOURCE_TYPES.DOCUMENT) return docSet.has(refIdStr);
    // Allow other types by default (governed by app access)
    return true;
  });
}

async function getUserContext(userId, appId) {
  const app = await ApplicationRepository.findById(appId);
  if (!app)
    return { roleIds: [], departmentIds: [], isAppOwner: false, organizationId: null, appId: null };

  const member = await OrganizationMemberRepository.findOne(userId, app.organizationId);

  if (!member) {
    return {
      roleIds: [],
      departmentIds: [],
      isAppOwner: app.owner.toString() === userId.toString(),
      organizationId: app.organizationId,
      appId: app.id,
    };
  }

  return {
    roleIds: (member.roleIds || []).map((id) => id.toString()),
    departmentIds: (member.departmentIds || []).map((id) => id.toString()),
    isAppOwner: app.owner.toString() === userId.toString(),
    organizationId: app.organizationId,
    appId: app.id,
  };
}

async function getAccessibleFormIds(formIds, userId, context, permissions) {
  const { appId, isAppOwner } = context;
  if (isAppOwner) return formIds;
  if (!permissions) return [];
  if (permissions.isOwner) return formIds;

  const appPerms = permissions.apps[appId.toString()] || [];
  const hasGlobalAppAccess =
    appPerms.includes(APP_PERMISSIONS.APP_MANAGE) || appPerms.includes(APP_PERMISSIONS.FORM_FILL);
  if (hasGlobalAppAccess) return formIds;

  return formIds.filter((id) => {
    const resPerms = permissions.resources[id.toString()] || [];
    return (
      resPerms.includes(APP_PERMISSIONS.FORM_VIEW) ||
      resPerms.includes(APP_PERMISSIONS.FORM_DESIGN) ||
      resPerms.includes(APP_PERMISSIONS.FORM_FILL)
    );
  });
}

async function getAccessibleViewIds(viewIds, userId, context, permissions) {
  const { appId, isAppOwner } = context;
  if (isAppOwner) return viewIds;
  if (!permissions) return [];
  if (permissions.isOwner) return viewIds;

  const appPerms = permissions.apps[appId.toString()] || [];
  const hasGlobalAppAccess =
    appPerms.includes(APP_PERMISSIONS.APP_MANAGE) || appPerms.includes(APP_PERMISSIONS.VIEW_DESIGN);
  if (hasGlobalAppAccess) return viewIds;

  return viewIds.filter((id) => {
    const resPerms = permissions.resources[id.toString()] || [];
    return (
      resPerms.includes(APP_PERMISSIONS.VIEW_VIEW) || resPerms.includes(APP_PERMISSIONS.VIEW_DESIGN)
    );
  });
}

async function getAccessibleDocumentIds(docIds, userId, context, permissions) {
  const { appId, roleIds, departmentIds, isAppOwner } = context;
  if (isAppOwner) return docIds;

  if (permissions) {
    if (permissions.isOwner) return docIds;
    const appIdStr = appId ? appId.toString() : null;
    const appPerms = permissions.apps[appIdStr] || [];
    if (
      appPerms.includes(APP_PERMISSIONS.APP_MANAGE) ||
      appPerms.includes(APP_PERMISSIONS.DOC_MANAGE)
    ) {
      return docIds;
    }
  }

  const results = await DocumentRepository.findAccessibleIds(docIds, userId, {
    roleIds,
    departmentIds,
  });
  return results;
}

const getResourceById = async (resourceId, userId) => {
  const resource = await ResourceRepository.findById(resourceId);
  if (!resource) throw ApiError.notFound('Resource not found');

  await accessService.ensureAppAccess(resource.appId, userId);

  let detail = null;
  if (resource.type === RESOURCE_TYPES.FORM) {
    detail = await formRepository.findById(resource.refId);
    if (!detail) throw ApiError.notFound('Form not found');
  } else if (resource.type === RESOURCE_TYPES.VIEW) {
    detail = await ViewRepository.findById(resource.refId);
    if (!detail) throw ApiError.notFound('View not found');
  } else if (resource.type === RESOURCE_TYPES.DOCUMENT) {
    detail = await DocumentRepository.findById(resource.refId);
    if (!detail) throw ApiError.notFound('Document not found');
  }

  return { ...resource, detail };
};

const _validateItems = async (items, appId) => {
  if (!Array.isArray(items)) throw ApiError.badRequest('Items must be an array');
  for (const it of items) {
    // For folders, auto-generate refId if missing before strict validation
    if (it.type === 'folder' && !it.refId) {
      it.refId = crypto.randomUUID();
    }

    if (!it || !it.type || !it.refId) throw ApiError.badRequest('Each item needs type and refId');

    if (it.type === RESOURCE_TYPES.FORM) {
      const f = await formRepository.findById(it.refId);
      if (!f || f.appId.toString() !== appId.toString())
        throw ApiError.badRequest('Form refId invalid for app');
      if (!it.meta) it.meta = {};
      if (it.meta.name === undefined) it.meta.name = f.name;
    } else if (it.type === RESOURCE_TYPES.VIEW) {
      const v = await ViewRepository.findById(it.refId);
      if (!v || v.appId.toString() !== appId.toString())
        throw ApiError.badRequest('View refId invalid for app');
      if (!it.meta) it.meta = {};
      if (it.meta.name === undefined) it.meta.name = v.name;
    } else if (it.type === RESOURCE_TYPES.DOCUMENT) {
      const d = await DocumentRepository.findById(it.refId);
      if (!d) throw ApiError.badRequest('Document refId invalid');
      if (!it.meta) it.meta = {};
      if (it.meta.name === undefined) it.meta.name = d.title || '未命名文档';

      if (it.parentId) {
        const parentResource = await ResourceRepository.findById(it.parentId);
        if (!parentResource || parentResource.appId !== appId.toString())
          throw ApiError.badRequest('Parent resource invalid for app');
      }
    } else if (it.type === RESOURCE_TYPES.FOLDER) {
      if (!it.meta) it.meta = {};
      if (it.meta.name === undefined) it.meta.name = '新建文件夹';
    }
  }
};

const saveResources = async (appId, items, userId) => {
  await accessService.ensureAppOwnership(appId, userId);
  await _validateItems(items, appId);

  const docsToInsert = items.map((it, idx) => ({
    id: it.id || crypto.randomUUID(),
    appId: appId.toString(),
    type: it.type,
    refId: it.refId.toString(),
    parentId: it.parentId ? it.parentId.toString() : null,
    order: it.order !== undefined ? it.order : idx,
    meta: it.type === RESOURCE_TYPES.FOLDER ? it.meta || {} : {},
    updatedAt: new Date(),
  }));

  await ResourceRepository.replaceAppResources(appId, docsToInsert);

  return getResources(appId.toString(), userId.toString());
};

const reorderResources = async (appId, ordered, userId) => {
  const canManage = await accessService.checkAppPermission(
    appId,
    userId,
    APP_PERMISSIONS.APP_MANAGE,
  );
  if (!canManage) throw ApiError.forbidden('Permission denied');

  if (ordered.length > 0) {
    await ResourceRepository.updateBulkOrder(
      ordered.map((o, idx) => ({
        id: o.id,
        appId: appId.toString(),
        order: idx,
      })),
    );
  }

  const pId = ordered[0] ? (await ResourceRepository.findById(ordered[0].id))?.parentId : null;
  return getResources(appId.toString(), userId.toString(), pId);
};

const setHidden = async (appId, type, id, hidden, userId) => {
  await ResourceRepository.update(id, { hidden: !!hidden });
  const doc = await ResourceRepository.findById(id);
  return getResources(appId.toString(), userId.toString(), doc?.parentId);
};

const setPinned = async (appId, type, id, pinned, userId) => {
  await ResourceRepository.update(id, { pinned: !!pinned });
  const doc = await ResourceRepository.findById(id);
  return getResources(appId.toString(), userId.toString(), doc?.parentId);
};

const upsertResourceItem = async (appId, item, userId) => {
  if (item.type == RESOURCE_TYPES.FOLDER && !item.refId) {
    item.refId = crypto.randomUUID();
  }
  await _validateItems([item], appId);
  const isFolder = item.type == RESOURCE_TYPES.FOLDER;
  const existing = isFolder
    ? null
    : await ResourceRepository.findOne({
        where: (table, drizzle) =>
          drizzle.and(
            drizzle.eq(table.appId, appId.toString()),
            drizzle.eq(table.type, item.type),
            drizzle.eq(table.refId, item.refId.toString()),
            drizzle.eq(table.deleted, false),
          ),
      });

  if (!existing) {
    const nextOrder = Date.now().toString(); // Fallback to timestamp for new items
    await ResourceRepository.create({
      id: crypto.randomUUID(),
      ...item,
      meta: item.type === RESOURCE_TYPES.FOLDER ? item.meta || {} : {},
      appId: appId.toString(),
      order: nextOrder,
      updatedAt: new Date(),
    });
  } else {
    await ResourceRepository.update(existing.id, {
      ...item,
      meta: item.type === RESOURCE_TYPES.FOLDER ? item.meta || {} : {},
      updatedAt: new Date(),
    });
  }
  return getResources(appId.toString(), userId.toString(), item.parentId);
};

const removeResourceItem = async (appId, type, id, userId) => {
  // 1. Locate the resource item in app_resources table
  const resource = await ResourceRepository.findOne({
    where: (t, d) =>
      d.and(
        d.eq(t.appId, appId.toString()),
        d.eq(t.type, type),
        d.or(d.eq(t.id, id.toString()), d.eq(t.refId, id.toString())),
        d.eq(t.deleted, false),
      ),
  });

  if (!resource) {
    throw ApiError.notFound('Resource not found');
  }

  // 2. Prevent deleting resources containing children (Pessimistic Integrity Shield)
  const hasChildren = await ResourceRepository.findOne({
    where: (t, d) => d.and(d.eq(t.parentId, resource.id), d.eq(t.deleted, false)),
  });
  if (hasChildren) {
    throw ApiError.badRequest('Resource is not empty');
  }

  // 3. Perform soft delete safely
  await ResourceRepository.softDelete(appId, type, id);
  return getResources(appId.toString(), userId.toString());
};

const syncMeta = async (appId, type, id, meta, userId) => {
  await ResourceRepository.syncMeta(appId, type, id, meta);
};

/**
 * Get resources for sync (cache-first mode).
 * Optimized for client side and bypasses permission filtering on individual items (relies on app access).
 */
const getResourcesSync = async (appId, userId, updatedAfter, parentId) => {
  await accessService.ensureAppAccess(appId, userId);

  const conditions = [(t, d) => d.eq(t.appId, appId.toString()), (t, d) => d.eq(t.deleted, false)];

  if (updatedAfter) {
    const date = new Date(updatedAfter);
    if (!isNaN(date.getTime())) {
      conditions.push((t, d) => d.gt(t.updatedAt, date));
    }
  }

  if (parentId !== undefined) {
    conditions.push((t, d) =>
      parentId === null || parentId === 'null'
        ? d.isNull(t.parentId)
        : d.eq(t.parentId, parentId.toString()),
    );
  }

  const items = await ResourceRepository.findAll({
    where: (t, d) => d.and(...conditions.map((c) => c(t, d))),
    order: (t, d) => [d.asc(t.order)],
  });

  const resolvedItems = await resolveResourcesMetadata(items);

  return { items: resolvedItems };
};

/**
 * Update resource metadata.
 */
const updateResourceMeta = async (appId, type, refId, meta, userId) => {
  await accessService.ensureAppAccess(appId, userId);

  const existing = await ResourceRepository.findOne({
    where: (t, d) =>
      d.and(
        d.eq(t.appId, appId.toString()),
        d.eq(t.type, type),
        d.eq(t.refId, refId.toString()),
        d.eq(t.deleted, false),
      ),
  });

  if (!existing) throw ApiError.notFound('Resource not found');

  const PHYSICAL_TYPES = new Set([
    RESOURCE_TYPES.DOCUMENT,
    RESOURCE_TYPES.FORM,
    RESOURCE_TYPES.VIEW,
  ]);

  if (!PHYSICAL_TYPES.has(type)) {
    const newMeta = { ...(existing.meta || {}), ...(meta || {}) };
    return await ResourceRepository.update(existing.id, { meta: newMeta, updatedAt: new Date() });
  }

  // Handle physical table updates for physical types
  if (type === RESOURCE_TYPES.DOCUMENT) {
    const updates = {};
    if (meta.name !== undefined) updates.title = meta.name;
    if (meta.categoryKeys !== undefined) {
      updates.tags = meta.categoryKeys.filter((k) => k !== 'ai_memory');
    }
    if (meta.tags !== undefined) updates.tags = meta.tags;
    if (meta.purpose !== undefined) updates.purpose = meta.purpose;
    if (meta.skillName !== undefined) updates.skillName = meta.skillName;
    if (meta.skillDescription !== undefined) updates.description = meta.skillDescription;
    if (meta.skillParameters !== undefined) updates.parameters = meta.skillParameters;

    if (Object.keys(updates).length > 0) {
      await DocumentRepository.update(refId, updates);
    }
  } else if (type === RESOURCE_TYPES.FORM) {
    const updates = {};
    if (meta.name !== undefined) updates.name = meta.name;
    if (meta.description !== undefined) updates.description = meta.description;
    if (Object.keys(updates).length > 0) {
      await formRepository.update(refId, updates);
    }
  } else if (type === RESOURCE_TYPES.VIEW) {
    const updates = {};
    if (meta.name !== undefined) updates.name = meta.name;
    if (meta.description !== undefined) updates.description = meta.description;
    if (Object.keys(updates).length > 0) {
      await ViewRepository.update(refId, updates);
    }
  }

  // Clean redundant keys from app_resources.meta and bump updatedAt
  const cleanedMeta = { ...(existing.meta || {}) };
  delete cleanedMeta.name;
  delete cleanedMeta.desc;
  delete cleanedMeta.description;
  delete cleanedMeta.tags;
  delete cleanedMeta.categoryKeys;
  delete cleanedMeta.purpose;
  delete cleanedMeta.isSkill;
  delete cleanedMeta.skillName;
  delete cleanedMeta.skillDescription;
  delete cleanedMeta.skillParameters;

  const updatedResource = await ResourceRepository.update(existing.id, {
    meta: cleanedMeta,
    updatedAt: new Date(),
  });

  return updatedResource;
};

const moveResource = async (appId, nodeId, newParentId, newOrder, userId) => {
  // Check permission (optional, can be done at controller or here)
  const targetParentId = newParentId === 'root' || !newParentId ? null : newParentId;

  await ResourceRepository.moveResourceNode(
    appId,
    nodeId,
    targetParentId,
    newOrder, // This is the rank string from frontend
  );

  return { success: true };
};

const getPath = async (refId, userId) => {
  const resourceItem = await ResourceRepository.findOne({
    where: (table, drizzle) => drizzle.eq(table.refId, refId.toString()),
  });

  if (!resourceItem) {
    const doc = await DocumentRepository.findById(refId);
    if (!doc) throw ApiError.notFound('Resource not found');
    return { id: doc.id, title: doc.title, isLeaf: true };
  }

  const { appId } = resourceItem;
  await accessService.ensureAppAccess(appId, userId);

  const ancestors = [];
  let cursor = resourceItem;
  while (cursor) {
    ancestors.push(cursor);
    if (!cursor.parentId) break;
    cursor = await ResourceRepository.findById(cursor.parentId);
  }

  const rev = ancestors.reverse();
  const pathIds = [null, ...rev.map((a) => a.id)];

  const allRelated = await ResourceRepository.findAll({
    where: (t, d) =>
      d.and(
        d.eq(t.appId, appId.toString()),
        d.or(...pathIds.map((pid) => (pid ? d.eq(t.parentId, pid) : d.isNull(t.parentId)))),
      ),
    order: (t, d) => [d.asc(t.order)],
  });

  const resolvedRelated = await resolveResourcesMetadata(allRelated);

  const parentIdsWithChildren = await ResourceRepository.findParentIds(appId);
  const hasChildrenSet = new Set(parentIdsWithChildren);

  const grouped = {};
  for (const r of resolvedRelated) {
    const pid = r.parentId || 'root';
    if (!grouped[pid]) grouped[pid] = [];
    grouped[pid].push({
      _id: r.id,
      refId: r.refId,
      title: r.meta?.name || '未命名',
      type: r.type,
      isLeaf: r.type !== 'document' || !hasChildrenSet.has(r.id),
    });
  }

  const buildNode = (res) => {
    const children = (grouped[res.id] || []).map((c) => {
      const ancestorMatch = rev.find((a) => a.id === c._id);
      return ancestorMatch && c.refId !== refId ? buildNode(ancestorMatch) : c;
    });
    const match = resolvedRelated.find((r) => r.id === res.id);
    return {
      _id: res.id,
      refId: res.refId,
      title: match?.meta?.name || res.meta?.name || '未命名',
      type: res.type,
      children,
    };
  };

  return buildNode(rev[0]);
};

export default {
  getResources,
  getResourceById,
  saveResources,
  reorderResources,
  setHidden,
  setPinned,
  upsertResourceItem,
  removeResourceItem,
  syncMeta,
  getResourcesSync,
  updateResourceMeta,
  moveResource,
  getPath,
  resolveResourcesMetadata,
};
