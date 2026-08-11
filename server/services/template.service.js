import { db } from '../db/index.js';
import { templates } from '../db/schema/index.js';
import { eq, and, or, sql, desc, count, ilike, inArray, ne } from 'drizzle-orm';
import TemplateRepository from '../repositories/template.repository.js';
import ApiError from '../utils/ApiError.js';
import accessService from './access.service.js';
import { blocksToPlain } from '../utils/contentProcessor.js';

const TEMPLATE_TYPES = ['document', 'prompt', 'ai-prompt'];

const normalizeTemplateType = (value) => {
  if (!value) return 'document';
  if (!TEMPLATE_TYPES.includes(value)) {
    throw ApiError.badRequest('Invalid template type', 'TEMPLATE_TYPE_INVALID');
  }
  return value;
};

const buildQueryFilters = async (query = {}, userId) => {
  const { appId, scope, keyword, type } = query;
  const filters = [];

  if (type) {
    if (typeof type === 'string') {
      if (!TEMPLATE_TYPES.includes(type)) {
        throw ApiError.badRequest('Invalid template type filter', 'TEMPLATE_TYPE_INVALID');
      }
      filters.push(eq(templates.type, type));
    } else if (type.$in && Array.isArray(type.$in)) {
      type.$in.forEach(t => {
        if (!TEMPLATE_TYPES.includes(t)) {
          throw ApiError.badRequest(`Invalid template type in list: ${t}`, 'TEMPLATE_TYPE_INVALID');
        }
      });
      filters.push(inArray(templates.type, type.$in));
    }
  }

  const userIdStr = userId.toString();

  if (scope === 'app') {
    if (!appId) {
      throw ApiError.badRequest('appId is required when filtering app templates', 'TEMPLATE_APP_REQUIRED');
    }
    await accessService.ensureAppAccess(appId, userId);
    filters.push(and(eq(templates.scope, 'app'), eq(templates.appId, appId.toString())));
  } else if (scope === 'personal') {
    filters.push(and(eq(templates.scope, 'personal'), eq(templates.createdBy, userIdStr)));
  } else if (appId) {
    await accessService.ensureAppAccess(appId, userId);
    filters.push(
      or(
        and(eq(templates.scope, 'personal'), eq(templates.createdBy, userIdStr)),
        and(eq(templates.scope, 'app'), eq(templates.appId, appId.toString()))
      )
    );
  } else {
    filters.push(and(eq(templates.scope, 'personal'), eq(templates.createdBy, userIdStr)));
  }

  if (keyword && keyword.trim()) {
    const pattern = `%${keyword.trim()}%`;
    filters.push(or(ilike(templates.name, pattern), ilike(templates.description, pattern)));
  }

  return and(...filters);
};

const listTemplates = async (query = {}, userId) => {
  const { page, limit, fields } = query;
  const filters = await buildQueryFilters(query, userId);
  
  const p = parseInt(page) || 1;
  const l = parseInt(limit);
  const offset = (p - 1) * l;

  if (!isNaN(l)) {
    const [items, [{ total }]] = await Promise.all([
      db.select().from(templates).where(filters).orderBy(desc(templates.updatedAt)).limit(l).offset(offset),
      db.select({ total: count(templates.id) }).from(templates).where(filters),
    ]);

    return {
      items: items.map(t => ({ ...t, _id: t.id })),
      pagination: {
        page: p,
        limit: l,
        total,
        hasMore: total > p * l,
      },
    };
  }

  const items = await db.select().from(templates).where(filters).orderBy(desc(templates.updatedAt));
  return items.map(t => ({ ...t, _id: t.id }));
};

const getTemplateById = async (id, userId) => {
  const template = await TemplateRepository.findById(id);
  if (!template || template.createdBy !== userId.toString()) {
    throw ApiError.notFound('Template not found', 'TEMPLATE_NOT_FOUND');
  }
  return { ...template, _id: template.id };
};

const createTemplate = async (payload = {}, userId) => {
  const { name, description, blocks, tags, appId, scope, type } = payload;
  if (!name || !name.trim()) {
    throw ApiError.badRequest('Template name is required', 'TEMPLATE_NAME_REQUIRED');
  }
  const resolvedType = normalizeTemplateType(type);
  let resolvedScope = (scope === 'app' || (!scope && appId)) ? 'app' : 'personal';
  let resolvedAppId = null;

  if (resolvedScope === 'app') {
    if (!appId) {
      throw ApiError.badRequest('appId is required for app templates', 'TEMPLATE_APP_REQUIRED');
    }
    await accessService.ensureAppOwnership(appId, userId);
    resolvedAppId = appId.toString();
  }

  const contentPlain = await blocksToPlain(blocks);

  const template = await TemplateRepository.create({
    name: name.trim(),
    description: description || '',
    blocks: Array.isArray(blocks) ? blocks : [],
    tags: Array.isArray(tags) ? tags : [],
    type: resolvedType,
    scope: resolvedScope,
    appId: resolvedAppId,
    contentPlain,
    createdBy: userId,
    updatedBy: userId,
  });

  return { ...template, _id: template.id };
};

const updateTemplate = async (id, payload = {}, userId) => {
  const template = await TemplateRepository.findById(id);
  if (!template || template.createdBy !== userId.toString()) {
    throw ApiError.notFound('Template not found', 'TEMPLATE_NOT_FOUND');
  }

  const updateData = {};
  if (payload.name !== undefined) {
    if (!payload.name || !payload.name.trim()) {
      throw ApiError.badRequest('Template name is required', 'TEMPLATE_NAME_REQUIRED');
    }
    updateData.name = payload.name.trim();
  }
  if (payload.description !== undefined) updateData.description = payload.description;
  if (payload.blocks !== undefined) {
    updateData.blocks = Array.isArray(payload.blocks) ? payload.blocks : [];
    updateData.contentPlain = await blocksToPlain(updateData.blocks);
  }
  if (payload.tags !== undefined) updateData.tags = Array.isArray(payload.tags) ? payload.tags : [];
  if (payload.type !== undefined) updateData.type = normalizeTemplateType(payload.type);

  if (payload.scope !== undefined || payload.appId !== undefined) {
    let nextScope = payload.scope || template.scope;
    let nextAppId = payload.appId || template.appId;

    if (payload.scope === 'personal' || (payload.appId === null && payload.scope !== 'app')) {
      nextScope = 'personal';
      nextAppId = null;
    } else if (nextScope === 'app') {
      if (!nextAppId) {
        throw ApiError.badRequest('appId is required for app templates', 'TEMPLATE_APP_REQUIRED');
      }
      await accessService.ensureAppOwnership(nextAppId, userId);
      nextAppId = nextAppId.toString();
    }

    updateData.scope = nextScope;
    updateData.appId = nextAppId;
  }

  updateData.updatedBy = userId.toString();

  const updated = await TemplateRepository.update(id, updateData);
  return { ...updated, _id: updated.id };
};

const deleteTemplate = async (id, userId) => {
  const template = await TemplateRepository.findById(id);
  if (!template || template.createdBy !== userId.toString()) {
    throw ApiError.notFound('Template not found', 'TEMPLATE_NOT_FOUND');
  }
  await TemplateRepository.delete(id);
  return { deleted: true, id };
};

export default {
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
};
