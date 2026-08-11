import OrgCategoryRepository from '../repositories/orgCategory.repository.js';
import { db } from '../db/index.js';
import { orgCategories } from '../db/schema/index.js';
import { eq, and, or, inArray, desc, ne } from 'drizzle-orm';
import OrganizationRepository from '../repositories/organization.repository.js';
import OrganizationMemberRepository from '../repositories/organizationMember.repository.js';
import ApiError from '../utils/ApiError.js';

/**
 * Get all categories for an organization
 */
const getCategories = async (organization, userId) => {
  const organizationId = organization.id;

  let results = [];
  if (organization.type === 'PERSONAL') {
    const memberships = await OrganizationMemberRepository.findByUserId(userId);
    const joinedOrgIds = memberships.filter(m => m.status === 'ACTIVE').map((m) => m.organizationId);

    results = await db
      .select()
      .from(orgCategories)
      .where(
        or(
          and(inArray(orgCategories.organizationId, joinedOrgIds), eq(orgCategories.scope, 'organization')),
          and(eq(orgCategories.organizationId, organizationId.toString()), eq(orgCategories.scope, 'user'), eq(orgCategories.createdBy, userId.toString()))
        )
      )
      .orderBy(orgCategories.scope, orgCategories.createdAt);

    const orgIds = [...new Set(results.map(c => c.organizationId))];
    const orgs = await OrganizationRepository.findAll(orgIds);
    const orgMap = Object.fromEntries(orgs.map(o => [o.id, o]));

    return results.map(c => ({
      ...c,
      _id: c.id,
      organizationId: orgMap[c.organizationId] || { id: c.organizationId, name: 'Unknown' }
    }));
  }

  results = await db
    .select()
    .from(orgCategories)
    .where(
      and(
        eq(orgCategories.organizationId, organizationId.toString()),
        or(eq(orgCategories.scope, 'organization'), and(eq(orgCategories.scope, 'user'), eq(orgCategories.createdBy, userId.toString())))
      )
    )
    .orderBy(orgCategories.scope, orgCategories.createdAt);

  return results.map(c => ({
    ...c,
    _id: c.id,
    organizationId: { id: organization.id, name: organization.name }
  }));
};

/**
 * Create a new category
 */
const createCategory = async (categoryData, organizationId, userId) => {
  const { key, label, icon, color, description, isSystem, scope } = categoryData;

  const filters = [eq(orgCategories.organizationId, organizationId.toString()), eq(orgCategories.key, key)];
  if (scope === 'user') {
    filters.push(eq(orgCategories.createdBy, userId.toString()));
  } else {
    filters.push(eq(orgCategories.scope, 'organization'));
  }

  const [existing] = await db.select().from(orgCategories).where(and(...filters));
  if (existing) {
    throw ApiError.conflict('Category key already exists', 'CATEGORY_EXISTS');
  }

  return await OrgCategoryRepository.create({
    organizationId,
    key,
    label,
    icon,
    color,
    description,
    isSystem: isSystem || false,
    scope: scope || 'organization',
    createdBy: userId,
  });
};

/**
 * Update a category
 */
const updateCategory = async (categoryId, updateData, organizationId) => {
  const category = await OrgCategoryRepository.findById(categoryId);
  if (!category || category.organizationId !== organizationId.toString()) {
    throw ApiError.notFound('Category not found', 'CATEGORY_NOT_FOUND');
  }

  const updates = {};
  if (category.isSystem) {
    const { label, icon, color, description } = updateData;
    if (label) updates.label = label;
    if (icon) updates.icon = icon;
    if (color) updates.color = color;
    if (description !== undefined) updates.description = description;
  } else {
    const { label, icon, color, description, key } = updateData;
    if (label) updates.label = label;
    if (icon) updates.icon = icon;
    if (color) updates.color = color;
    if (description !== undefined) updates.description = description;
    if (key && key !== category.key) {
      const [existing] = await db
        .select()
        .from(orgCategories)
        .where(
          and(
            eq(orgCategories.organizationId, organizationId.toString()),
            eq(orgCategories.key, key),
            ne(orgCategories.id, categoryId)
          )
        );
      if (existing) {
        throw ApiError.conflict('New category key already exists', 'CATEGORY_EXISTS');
      }
      updates.key = key;
    }
  }

  return await OrgCategoryRepository.update(categoryId, updates);
};

/**
 * Delete a category
 */
const deleteCategory = async (categoryId, organizationId) => {
  const category = await OrgCategoryRepository.findById(categoryId);
  if (!category || category.organizationId !== organizationId.toString()) {
    throw ApiError.notFound('Category not found', 'CATEGORY_NOT_FOUND');
  }

  if (category.isSystem) {
    throw ApiError.forbidden('System categories cannot be deleted', 'SYSTEM_CATEGORY_LOCKED');
  }

  await OrgCategoryRepository.delete(categoryId);
};

export default {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
