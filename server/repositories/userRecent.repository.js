import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userRecents } from '../db/schema/index.js';
import { createBaseRepository } from './base.repository.js';
import { mapResponse } from '../db/utils.js';

const baseRepo = createBaseRepository(userRecents);

/**
 * User Recent Repository
 * Manages user's recent activities in PostgreSQL.
 */
const UserRecentRepository = {
  ...baseRepo,

  /**
   * Get recent items for a user
   * @param {string} userId - User ID
   * @param {number} [limit=50] - Number of items to return
   * @returns {Promise<Array>}
   */
  async findByUserId(userId, limit = 50) {
    const results = await db
      .select()
      .from(userRecents)
      .where(eq(userRecents.userId, userId))
      .orderBy(desc(userRecents.lastUsedAt))
      .limit(limit);
      
    return results.map(mapResponse);
  },

  /**
   * Push/Touch a recent item
   * @param {string} userId 
   * @param {string} refType 
   * @param {string} refId 
   */
  async touchRecent(userId, refType, refId) {
    const [result] = await db
      .insert(userRecents)
      .values({
        userId,
        refType,
        refId: refId.toString(),
        lastUsedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userRecents.userId, userRecents.refType, userRecents.refId],
        set: {
          lastUsedAt: new Date(),
        }
      })
      .returning();
      
    return mapResponse(result);
  },

  /**
   * Delete by user ID
   */
  async deleteByUserId(userId) {
    const results = await db
      .delete(userRecents)
      .where(eq(userRecents.userId, userId))
      .returning();
    return results.map(mapResponse);
  }
};

export default UserRecentRepository;
