import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userDashboards } from '../db/schema/index.js';
import { createBaseRepository } from './base.repository.js';
import { mapResponse } from '../db/utils.js';

const baseRepo = createBaseRepository(userDashboards);

/**
 * User Dashboard Repository
 * Manages unified dashboard items (favorites, recents, views) in PostgreSQL.
 */
const UserDashboardRepository = {
  ...baseRepo,

  /**
   * Find items for a user in an organization
   */
  async findByUserAndOrg(userId, organizationId, itemType = null) {
    const filters = [
      eq(userDashboards.userId, userId),
      eq(userDashboards.organizationId, organizationId.toString())
    ];
    if (itemType) {
      filters.push(eq(userDashboards.itemType, itemType));
    }

    const results = await db
      .select()
      .from(userDashboards)
      .where(and(...filters))
      .orderBy(desc(userDashboards.lastUsedAt), desc(userDashboards.addedAt));
      
    return results.map(mapResponse);
  },

  /**
   * Upsert a dashboard item (favorite or recent)
   */
  async upsertItem(userId, organizationId, data) {
    const { itemType, refType, refId, ...rest } = data;
    
    const [result] = await db
      .insert(userDashboards)
      .values({
        ...data,
        userId,
        organizationId: organizationId.toString(),
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [
          userDashboards.userId,
          userDashboards.organizationId,
          userDashboards.itemType,
          userDashboards.refType,
          userDashboards.refId
        ],
        set: {
          ...rest,
          updatedAt: new Date()
        }
      })
      .returning();
      
    return mapResponse(result);
  },

  /**
   * Append a view layout component to the views array atomically
   */
  async appendView(userId, organizationId, layoutComponentData) {
    const [result] = await db
      .insert(userDashboards)
      .values({
        userId,
        organizationId: organizationId.toString(),
        itemType: 'views',
        refType: 'View',
        refId: 'default',
        views: [layoutComponentData],
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [
          userDashboards.userId,
          userDashboards.organizationId,
          userDashboards.itemType,
          userDashboards.refType,
          userDashboards.refId
        ],
        set: {
          views: sql`${userDashboards.views} || ${JSON.stringify([layoutComponentData])}::jsonb`,
          updatedAt: new Date()
        }
      })
      .returning();
    return mapResponse(result);
  },

  /**
   * Remove items beyond a certain limit (for recents)
   */
  async trimItems(userId, organizationId, itemType, refType, limit) {
    // Find IDs to keep
    const toKeep = await db
      .select({ id: userDashboards.id })
      .from(userDashboards)
      .where(and(
        eq(userDashboards.userId, userId),
        eq(userDashboards.organizationId, organizationId.toString()),
        eq(userDashboards.itemType, itemType),
        eq(userDashboards.refType, refType)
      ))
      .orderBy(desc(userDashboards.lastUsedAt))
      .limit(limit);

    if (toKeep.length < limit) return;

    const keepIds = toKeep.map(k => k.id);

    return await db
      .delete(userDashboards)
      .where(and(
        eq(userDashboards.userId, userId),
        eq(userDashboards.organizationId, organizationId.toString()),
        eq(userDashboards.itemType, itemType),
        eq(userDashboards.refType, refType),
        sql`NOT (${userDashboards.id} IN (${sql.join(keepIds.map(id => sql`${id}`), sql`, `)}))`
      ));
  },

  /**
   * Delete by user ID
   */
  async deleteByUserId(userId) {
    const results = await db
      .delete(userDashboards)
      .where(eq(userDashboards.userId, userId))
      .returning();
    return results.map(mapResponse);
  },

  /**
   * Delete by reference (e.g. when an app is deleted)
   */
  async deleteByRef(refType, refId) {
    const results = await db
      .delete(userDashboards)
      .where(and(
        eq(userDashboards.refType, refType),
        eq(userDashboards.refId, refId.toString())
      ))
      .returning();
    return results.map(mapResponse);
  }
};

export default UserDashboardRepository;
