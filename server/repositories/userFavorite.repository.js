import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userFavorites } from '../db/schema/index.js';
import { createBaseRepository } from './base.repository.js';
import { mapResponse } from '../db/utils.js';

const baseRepo = createBaseRepository(userFavorites);

/**
 * User Favorite Repository
 * Manages user favorite items (Applications, Documents, etc.) in PostgreSQL.
 * Flattens the original Mongoose array-based structure into individual rows.
 */
const UserFavoriteRepository = {
  ...baseRepo,

  /**
   * Get all favorites for a user
   * @param {string} userId - The user ID
   * @param {string} [organizationId] - Optional organization filter
   * @returns {Promise<Array>} List of favorite items
   */
  async findByUserId(userId, organizationId = null) {
    const filters = [eq(userFavorites.userId, userId)];
    if (organizationId) {
      filters.push(eq(userFavorites.organizationId, organizationId));
    }
    
    const results = await db
      .select()
      .from(userFavorites)
      .where(and(...filters))
      .orderBy(desc(userFavorites.addedAt));
      
    return results.map(mapResponse);
  },

  /**
   * Toggle a favorite item
   * @param {Object} params - userId, refId, refType, organizationId
   * @param {boolean} favorite - true to add, false to remove
   */
  async toggleFavorite(userId, refType, refId, favorite, organizationId = null) {
    if (favorite) {
      // Add favorite (Upsert equivalent)
      const existing = await this.findOne({
        where: (t, { eq, and }) => {
          const conds = [
            eq(t.userId, userId),
            eq(t.refType, refType),
            eq(t.refId, refId.toString())
          ];
          if (organizationId) conds.push(eq(t.organizationId, organizationId));
          return and(...conds);
        }
      });

      if (!existing) {
        return await this.create({
          userId,
          refType,
          refId: refId.toString(),
          organizationId,
          addedAt: new Date(),
        });
      }
      return existing;
    } else {
      // Remove favorite
      const conds = [
        eq(userFavorites.userId, userId),
        eq(userFavorites.refType, refType),
        eq(userFavorites.refId, refId.toString())
      ];
      if (organizationId) conds.push(eq(userFavorites.organizationId, organizationId));

      const [deleted] = await db
        .delete(userFavorites)
        .where(and(...conds))
        .returning();
        
      return mapResponse(deleted);
    },
  async deleteByUserId(userId) {
    const results = await db
      .delete(userFavorites)
      .where(eq(userFavorites.userId, userId))
      .returning();
    return results.map(mapResponse);
  }
};

export default UserFavoriteRepository;
