import ApplicationRepository from '../repositories/application.repository.js';
import PermissionAssignmentRepository from '../repositories/permissionAssignment.repository.js';
import RoleRepository from '../repositories/role.repository.js';
import { formRecordRepository } from '../repositories/formRecord.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { APP_PERMISSIONS } from '../constants/permissions.js';
import { blocksToPlain } from '../utils/contentProcessor.js';
import resourceService from './resource.service.js';
import fileService from './file.service.js';
import accessService from './access.service.js';
import MemoryService from './memory/MemoryService.js';
import DocumentRepository from '../repositories/document.repository.js';
import ResourceRepository from '../repositories/resource.repository.js';
import OrganizationMemberRepository from '../repositories/organizationMember.repository.js';
import permissionCache from './permissionCache.service.js';

async function touchRecent(userId, orgId, docId) {
  // Logic moved to dashboardService touchRecent if needed
}

async function resolveDocumentContext(doc) {
  if (!doc) return null;
  if (doc.appRef) return { appId: doc.appRef.toString() };
  const record = await formRecordRepository.findOne({
    where: (t, { eq }) => eq(t.docId, doc.id),
  });
  if (record) return { appId: record.appId, formId: record.formId };
  return null;
}

async function createGeneralDoc(appId, payload, userId) {
  const {
    title = '',
    attachments = [],
    tags: rawTags = [],
    parentId,
    isResource = true,
    docType = 'general',
    purpose = 'NORMAL',
    skillName = null,
    description = null,
    parameters = {},
  } = payload || {};

  // 兼容 AI 传入逗号分隔字符串的场景，统一转为数组
  const tags = Array.isArray(rawTags)
    ? rawTags
    : (typeof rawTags === 'string' && rawTags.trim()
        ? rawTags.split(',').map((t) => t.trim()).filter(Boolean)
        : []);

  let app = null;
  if (appId) app = await ApplicationRepository.findById(appId);

  const contentPlain = await blocksToPlain(payload.blocks);

  const doc = await DocumentRepository.create({
    title,
    blocks: payload.blocks || [],
    contentPlain,
    attachments,
    originalFileId: payload.originalFileId ? payload.originalFileId.toString() : null,
    tags: tags || [],
    docType,
    appRef: appId ? appId.toString() : null,
    createdBy: userId ? userId.toString() : null,
    updatedBy: userId ? userId.toString() : null,
    purpose,
    skillName,
    description,
    parameters,
  });

  const orgId = app ? app.organizationId.toString() : payload.organizationId;
  await touchRecent(userId, orgId, doc.id);

  if (payload.originalFileId) {
    try {
      await fileService.incrementRefCount(payload.originalFileId);
    } catch (e) {}
  }

  if (app && isResource !== false) {
    try {
      const categoryKeys =
        doc.docType === 'ai_memory' || doc.docType === 'ai_memory_archive' ? ['ai_memory'] : [];
      await resourceService.upsertResourceItem(
        appId.toString(),
        {
          type: 'document',
          refId: doc.id.toString(),
          meta: {},
          parentId: parentId ? parentId.toString() : null,
        },
        userId.toString(),
      );
    } catch (e) {}
  }

  import('./resource.events.js').then((m) => {
    m.default.emitCreated({ resourceId: doc.id, type: 'document', appId });
  });

  return doc;
}

async function dispatchCreate(body, userId) {
  let { appId, parentId, isResource } = body || {};
  if (parentId) {
    const parentResource = await ResourceRepository.findById(parentId);
    if (parentResource) {
      if (appId && appId !== parentResource.appId) throw ApiError.badRequest('Parent mismatch');
      appId = parentResource.appId;
      body.appId = appId;
    } else {
      const parentDoc = await DocumentRepository.findById(parentId);
      if (!parentDoc) throw ApiError.notFound('Parent not found');
    }
  }
  return createGeneralDoc(
    appId ? appId.toString() : null,
    { ...body, isResource },
    userId ? userId.toString() : null,
  );
}

async function getUserContext(userId, appId) {
  if (!appId) return { roleIds: [], departmentIds: [] };
  const app = await ApplicationRepository.findById(appId);
  if (!app) return { roleIds: [], departmentIds: [] };
  const member = await OrganizationMemberRepository.findOne(userId, app.organizationId.toString());
  if (!member || member.status !== 'ACTIVE')
    return {
      roleIds: [],
      departmentIds: [],
      isAppOwner: app.owner.toString() === userId.toString(),
    };

  return {
    roleIds: (member.roleIds || []).map((id) => id.toString()),
    departmentIds: (member.departmentIds || []).map((id) => id.toString()),
    isAppOwner: app.owner.toString() === userId.toString(),
  };
}

async function getSingle(docId, userId) {
  const doc = await DocumentRepository.findById(docId);
  if (!doc) throw ApiError.notFound('Document not found');
  if (doc.originalFileId) {
    const file = await fileService.getById(doc.originalFileId);
    if (file) {
      doc.originalFile = {
        _id: file.id || file._id,
        name: file.name,
        size: file.size,
        createdBy: file.createdBy,
      };
    }
  }
  return doc;
}

async function update(docId, body, userId) {
  const existing = await DocumentRepository.findById(docId);
  if (!existing) throw ApiError.notFound('Document not found');

  const updates = { updatedBy: userId ? userId.toString() : null, updatedAt: new Date() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.blocks !== undefined) {
    updates.blocks = body.blocks;
    updates.contentPlain = await blocksToPlain(body.blocks);
  }
  if (body.attachments !== undefined) updates.attachments = body.attachments;
  if (body.tags !== undefined) updates.tags = body.tags;
  if (body.docType !== undefined) updates.docType = body.docType;
  if (body.purpose !== undefined) {
    updates.purpose = body.purpose;
  } else if (body.isSkill !== undefined) {
    updates.purpose = body.isSkill ? 'SKILL' : 'NORMAL';
  }
  if (body.skillName !== undefined) updates.skillName = body.skillName;
  if (body.description !== undefined) {
    updates.description = body.description;
  } else if (body.skillDescription !== undefined) {
    updates.description = body.skillDescription;
  }
  if (body.parameters !== undefined) {
    updates.parameters = body.parameters;
  } else if (body.skillParameters !== undefined) {
    updates.parameters = body.skillParameters;
  }

  const doc = await DocumentRepository.update(docId, updates);

  if (body.title !== undefined || body.blocks !== undefined) {
    import('./resource.events.js').then((m) => {
      m.default.emitUpdated({
        resourceId: docId,
        type: 'document',
        appId: doc.appRef,
      });
    });
  }

  if (
    doc.docType === 'ai_memory' ||
    (existing.docType === 'ai_memory' && doc.docType !== 'ai_memory')
  ) {
    if (doc.docType === 'ai_memory')
      await MemoryService.indexDocument(docId, doc.appRef, doc.blocks);
    else await MemoryService.unindexDocument(docId);
  }

  // No syncMeta needed as metadata is dynamically loaded from the documents table
  return doc;
}
async function list(queryParams, routeParams, userId) {
  const { appId: rAppId, parentId: rParentId } = routeParams || {};
  const {
    appId: qAppId,
    parentId: qParentId,
    q,
    limit = 20,
    page = 1,
    docType,
    purpose,
  } = queryParams || {};
  const appId = qAppId || rAppId;
  const parentId = qParentId || rParentId;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const context = await getUserContext(userId, appId);
  const conditions = [DocumentRepository.getAccessQuery(userId, context)];

  if (docType) conditions.push((t, d) => d.eq(t.docType, docType));
  if (purpose) conditions.push((t, d) => d.eq(t.purpose, purpose));
  if (appId && !parentId) conditions.push((t, d) => d.eq(t.appRef, appId));

  if (parentId) {
    if (!appId) return { items: [], pagination: { page, limit, total: 0 } };
    const targetParentId = parentId === 'root' ? null : parentId;
    const resourceDocs = await ResourceRepository.findByAppAndParent(appId, targetParentId);
    const resourceIds = resourceDocs.map((r) => r.refId);
    if (resourceIds.length === 0) return { items: [], pagination: { page, limit, total: 0 } };
    conditions.push((t, d) => d.inArray(t.id, resourceIds));

    if (q && q.trim()) {
      conditions.push((t, d) =>
        d.or(d.ilike(t.title, `%${q.trim()}%`), d.ilike(t.contentPlain, `%${q.trim()}%`)),
      );
    }

    const { items, total } = await DocumentRepository.findWithAccess({
      conditions,
      limit: parseInt(limit),
      offset: skip,
    });

    if (items.length > 0) {
      const ids = items.map((d) => d.id);
      const parentIdsWithChildren = await ResourceRepository.findParentIdsInList(appId, ids);
      const pidsWithChildren = new Set(parentIdsWithChildren);
      items.forEach((d) => {
        d.isLeaf = !pidsWithChildren.has(d.id);
      });
    }
    return { items, pagination: { page: parseInt(page), limit: parseInt(limit), total } };
  }

  // Flat query fallback (e.g. for plugin properties dropdown selection)
  if (appId) {
    if (q && q.trim()) {
      conditions.push((t, d) =>
        d.or(d.ilike(t.title, `%${q.trim()}%`), d.ilike(t.contentPlain, `%${q.trim()}%`)),
      );
    }
    const { items, total } = await DocumentRepository.findWithAccess({
      conditions,
      limit: parseInt(limit),
      offset: skip,
    });
    return { items, pagination: { page: parseInt(page), limit: parseInt(limit), total } };
  }

  return { items: [], pagination: { page: 1, limit: 20, total: 0 } };
}

async function remove(docId, userId) {
  const doc = await DocumentRepository.findById(docId);
  if (!doc) throw ApiError.notFound('Document not found');

  const resourceEntries = await ResourceRepository.findAll({
    where: (t, d) => d.and(d.eq(t.refId, docId), d.eq(t.deleted, false)),
  });
  for (const entry of resourceEntries) {
    await resourceService.removeResourceItem(entry.appId, 'document', docId, userId);
  }

  if (doc.docType === 'ai_memory') await MemoryService.unindexDocument(docId);

  import('./resource.events.js').then((m) => {
    m.default.emitDeleted({ resourceId: docId, type: 'document', appId: doc.appRef });
  });

  await DocumentRepository.delete(docId);
  if (doc.originalFileId) {
    try {
      await fileService.decrementRefCount(doc.originalFileId);
    } catch (e) {}
  }
  return { deleted: true, id: docId };
}

async function recent(userId, orgId, limit = 6, lastId = null, q = null) {
  let appIds = null;
  if (orgId) {
    const apps = await ApplicationRepository.findByOrganization(orgId);
    appIds = apps.map((a) => a.id);
  }

  const { items, hasMore } = await DocumentRepository.findRecent({
    userId,
    appIds,
    limit: parseInt(limit),
    lastId,
    query: q,
  });

  if (items.length > 0) {
    const docIds = items.map((d) => d.id);
    const resItems = await ResourceRepository.findAll({
      where: (t, d) => d.and(d.inArray(t.refId, docIds), d.eq(t.deleted, false)),
    });
    const resourceMap = new Map(resItems.map((r) => [r.refId, r]));
    const parentIds = [...new Set(resItems.map((r) => r.parentId).filter(Boolean))];

    if (parentIds.length > 0) {
      const parents = await DocumentRepository.findTitlesByIds(parentIds);
      const parentMap = new Map(parents.map((p) => [p.id, p.title]));
      items.forEach((it) => {
        const res = resourceMap.get(it.id);
        it.parentName = res?.parentId ? parentMap.get(res.parentId) : null;
      });
    }
  }

  return {
    items,
    pagination: {
      limit: parseInt(limit),
      hasMore,
      nextLastId: items.length ? items[items.length - 1].id : null,
    },
  };
}

async function shareDocument(docId, shares, userId) {
  const doc = await DocumentRepository.findById(docId);
  if (!doc) throw ApiError.notFound('Document not found');
  await DocumentRepository.update(docId, { shares });

  if (doc.appRef) {
    const app = await ApplicationRepository.findById(doc.appRef);
    if (app) {
      const organizationId = app.organizationId.toString();
      await PermissionAssignmentRepository.deleteMany({ resourceId: docId, scope: 'RESOURCE' });
      for (const share of shares) {
        const roleName = `Resource ${share.permission}`;
        let role = await RoleRepository.findOne({ organizationId, name: roleName, scope: 'APP' });
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
          resourceId: docId,
          createdBy: userId.toString(),
        });
      }
      await permissionCache.invalidateOrganizationCaches(organizationId);
    }
  }
  return { success: true };
}

async function getWithChildren(docId, userId) {
  const result = await DocumentRepository.findWithChildren(docId);
  if (!result) throw ApiError.notFound('Document not found');

  const { doc, children } = result;

  if (doc.originalFileId) {
    const file = await fileService.getById(doc.originalFileId);
    if (file) {
      doc.originalFile = {
        _id: file.id || file._id,
        name: file.name,
        size: file.size,
        createdBy: file.createdBy,
      };
    }
  }

  await checkPermission(doc, userId, 'VIEW');

  return { doc, children };
}

async function checkPermission(doc, userId, requiredPermission = 'VIEW') {
  if (doc.createdBy?.toString() === userId.toString()) return true;

  let context = { roleIds: [], departmentIds: [] };
  let appId = null;
  if (doc.docType === 'general' && doc.appRef) appId = doc.appRef;
  else if (doc.docType !== 'general') {
    const ctx = await resolveDocumentContext(doc);
    if (ctx) appId = ctx.appId;
  }

  if (appId) {
    const canManage = await accessService.checkAppPermission(
      appId,
      userId,
      APP_PERMISSIONS.DOC_MANAGE,
    );
    if (canManage) return true;
    context = await getUserContext(userId, appId);
    if (context.isAppOwner) return true;
  }

  if (!doc.shares || !Array.isArray(doc.shares)) return false;

  const checkLevel = (actual, required) => {
    if (actual === 'EDIT') return true;
    if (actual === 'VIEW' && required === 'VIEW') return true;
    return false;
  };

  const userShare = doc.shares.find(
    (s) => s.targetType === 'USER' && s.targetId.toString() === userId.toString(),
  );
  if (userShare) return checkLevel(userShare.permission, requiredPermission);

  const roleShares = doc.shares.filter(
    (s) => s.targetType === 'ROLE' && context.roleIds.includes(s.targetId.toString()),
  );
  if (roleShares.some((s) => checkLevel(s.permission, requiredPermission))) return true;

  const deptShares = doc.shares.filter(
    (s) => s.targetType === 'DEPARTMENT' && context.departmentIds.includes(s.targetId.toString()),
  );
  if (deptShares.some((s) => checkLevel(s.permission, requiredPermission))) return true;

  const allShare = doc.shares.find((s) => s.targetType === 'ALL');
  if (allShare && checkLevel(allShare.permission, requiredPermission)) return true;

  return false;
}

export default {
  dispatchCreate,
  getSingle,
  update,
  list,
  remove,
  recent,
  resolveDocumentContext,
  createGeneralDoc,
  getWithChildren,
  shareDocument,
  checkPermission,
};
