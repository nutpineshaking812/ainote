import { db } from '../db/index.js';
import { userProperties } from '../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { mapResponse } from '../db/utils.js';

/**
 * UserPropertyRepository using Drizzle ORM
 * Handles persistence for arbitrary user properties with atomic JSONB operations.
 */
export const UserPropertyRepository = {
  /**
   * Find a single property record by user ID and key.
   * Returns the full object for consistency with other repositories.
   */
  async findOne(userId, key) {
    if (!userId || !key) return null;
    
    const [result] = await db
      .select()
      .from(userProperties)
      .where(and(eq(userProperties.userId, userId), eq(userProperties.key, key)))
      .limit(1);

    return mapResponse(result);
  },

  /**
   * Overwrite or Create a property (Upsert).
   */
  async upsert(userId, key, value, expiresAt = null) {
    const values = { userId, key, value };
    if (expiresAt !== undefined) values.expiresAt = expiresAt;

    const [result] = await db
      .insert(userProperties)
      .values(values)
      .onConflictDoUpdate({
        target: [userProperties.userId, userProperties.key],
        set: { 
          value, 
          ...(expiresAt !== undefined ? { expiresAt } : {}), 
          updatedAt: new Date() 
        },
      })
      .returning();

    return mapResponse(result);
  },

  /**
   * Create if not exists, otherwise do nothing.
   */
  async insertIgnore(userId, key, value, expiresAt = null) {
    const values = { userId, key, value };
    if (expiresAt !== undefined) values.expiresAt = expiresAt;

    const [result] = await db
      .insert(userProperties)
      .values(values)
      .onConflictDoNothing()
      .returning();

    return mapResponse(result);
  },

  /**
   * Atomic numeric increment for JSONB values.
   * Leverages PostgreSQL's strong consistency.
   */
  async increment(userId, key, delta, expiresAt = null) {
    const values = { userId, key, value: delta };
    if (expiresAt !== undefined) values.expiresAt = expiresAt;

    const [result] = await db
      .insert(userProperties)
      .values(values)
      .onConflictDoUpdate({
        target: [userProperties.userId, userProperties.key],
        set: {
          value: sql`(COALESCE((CASE WHEN (${userProperties.value} #>> '{}') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${userProperties.value} #>> '{}')::numeric ELSE 0 END), 0) + ${delta})::text::jsonb`,
          ...(expiresAt !== undefined ? { expiresAt } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();

    return mapResponse(result);
  },

  /**
   * Delete a property.
   */
  async delete(userId, key) {
    if (!userId || !key) return false;
    const [result] = await db
      .delete(userProperties)
      .where(and(eq(userProperties.userId, userId), eq(userProperties.key, key)))
      .returning();
    
    return !!result;
  }
};

export default UserPropertyRepository;

