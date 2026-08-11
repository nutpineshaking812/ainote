import { eq, ne, and, inArray, isNull, sql, asc, desc, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { appResources } from '../db/schema/index.js';
import { mapResponse } from '../db/utils.js';
import { createBaseRepository } from './base.repository.js';

/**
 * Resource Repository
 * Encapsulates all PostgreSQL interactions for the app_resources table.
 */
export const ResourceRepository = {
  table: appResources,
  ...createBaseRepository(appResources),

  /**
   * Find resources by appId and parentId, ordered by 'order'.
   */
  async findByAppAndParent(appId, parentId = null) {
    const results = await db.query.appResources.findMany({
      where: and(
        eq(appResources.appId, appId.toString()),
        parentId ? eq(appResources.parentId, parentId.toString()) : isNull(appResources.parentId),
        eq(appResources.deleted, false)
      ),
      orderBy: [asc(appResources.order)],
    });
    return mapResponse(results);
  },

  /**
   * Find descendants recursively using a CTE.
   */
  async findDescendantsRecursive(resourceIds) {
    if (!resourceIds || resourceIds.length === 0) return [];

    const results = await db.execute(sql`
      WITH RECURSIVE descendant_tree AS (
        SELECT * FROM lc.app_resources WHERE id IN (${sql.join(resourceIds.map(id => sql`${id}`), sql`, `)})
        UNION ALL
        SELECT ar.* FROM lc.app_resources ar
        INNER JOIN descendant_tree dt ON ar.parent_id = dt.id
        WHERE ar.deleted = false
      )
      SELECT * FROM descendant_tree
    `);

    return mapResponse(results.rows);
  },


  /**
   * Bulk update order for multiple items.
   * NOTE: This is still here for compatibility but should be used sparingly with strings.
   */
  async updateBulkOrder(items) {
    if (!items || items.length === 0) return;

    await db.transaction(async (tx) => {
      for (const it of items) {
        await tx
          .update(appResources)
          .set({ order: it.order, updatedAt: new Date() })
          .where(and(
            eq(appResources.appId, it.appId.toString()),
            eq(appResources.id, it.id)
          ));
      }
    });
  },

  /**
   * Delete all resources for an application.
   */
  async deleteByAppId(appId, tx = db) {
    return await tx.delete(appResources).where(eq(appResources.appId, appId.toString()));
  },

  /**
   * Check if an application has any resources.
   */
  async hasResources(appId) {
    const results = await db
      .select({ count: sql`count(*)` })
      .from(appResources)
      .where(and(eq(appResources.appId, appId.toString()), eq(appResources.deleted, false)));
    return parseInt(results[0].count) > 0;
  },

  /**
   * Soft delete a resource.
   */
  async softDelete(appId, type, refId) {
    return await db
      .update(appResources)
      .set({
        deleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(appResources.appId, appId.toString()), 
        eq(appResources.type, type), 
        or(
          eq(appResources.id, refId.toString()),
          eq(appResources.refId, refId.toString())
        )
      ));
  },

  /**
   * Sync metadata.
   */
  async syncMeta(appId, type, refId, meta) {
    return await db
      .update(appResources)
      .set({ meta, updatedAt: new Date() })
      .where(and(
        eq(appResources.appId, appId.toString()), 
        eq(appResources.type, type), 
        or(
          eq(appResources.id, refId.toString()),
          eq(appResources.refId, refId.toString())
        )
      ));
  },

  /**
   * Search resources with document details.
   */
  async searchResources(conditions, limit = 100) {
    const { documents } = await import('../db/schema/index.js');
    const rows = await db
      .select({
        resource: appResources,
        doc: documents
      })
      .from(appResources)
      .leftJoin(documents, eq(appResources.refId, documents.id))
      .where(and(...conditions))
      .limit(limit);
    
    return rows.map(r => ({ ...mapResponse([r.resource])[0], document: mapResponse([r.doc])[0] }));
  },

  /**
   * Get all unique parentIds for a given appId.
   */
  async findParentIds(appId) {
    const results = await db
      .select({ pid: appResources.parentId })
      .from(appResources)
      .where(and(
        eq(appResources.appId, appId.toString()),
        sql`${appResources.parentId} IS NOT NULL`,
        eq(appResources.deleted, false)
      ))
      .groupBy(appResources.parentId);
    return results.map(r => r.pid);
  },

  /**
   * Replace all resources for an application in a transaction.
   */
  async replaceAppResources(appId, items) {
    await db.transaction(async (tx) => {
      await tx.delete(appResources).where(eq(appResources.appId, appId.toString()));
      if (items.length > 0) {
        await tx.insert(appResources).values(items);
      }
    });
  },

  /**
   * Move a resource node using Lexorank provided by frontend.
   */
  async moveResourceNode(appId, nodeId, targetParentId, newRank) {
    // Update only the moved item with the rank provided by frontend
    await db
      .update(appResources)
      .set({ 
        parentId: targetParentId, 
        order: newRank, 
        updatedAt: new Date() 
      })
      .where(and(
        eq(appResources.id, nodeId),
        eq(appResources.appId, appId.toString())
      ));
    
    return newRank;
  },

  /**
   * Find which IDs from a list are parentIds in a given application.
   */
  async findParentIdsInList(appId, ids) {
    if (!ids || ids.length === 0) return [];
    const results = await db
      .select({ pid: appResources.parentId })
      .from(appResources)
      .where(and(
        eq(appResources.appId, appId.toString()), 
        inArray(appResources.parentId, ids),
        eq(appResources.deleted, false)
      ))
      .groupBy(appResources.parentId);
    return results.map(r => r.pid);
  }
};

export default ResourceRepository;
