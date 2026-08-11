import { eq, or, and, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { users } from '../db/schema/index.js';
import { mapResponse } from '../db/utils.js';
import { createBaseRepository } from './base.repository.js';

/**
 * User Repository
 * Encapsulates all PostgreSQL interactions for the users table.
 */
export const UserRepository = {
  table: users,
  ...createBaseRepository(users),

  /**
   * Find user by username or email
   */
  async findByCredentials(identity) {
    const [result] = await db
      .select()
      .from(users)
      .where(or(eq(users.username, identity), eq(users.email, identity)));
    return mapResponse(result);
  },

  async findOne(filter = {}) {
    const [result] = await db
      .select()
      .from(users)
      .limit(1);
    return mapResponse(result);
  },

  async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const results = await db
      .select()
      .from(users)
      .where(inArray(users.id, ids));
    return results.map(mapResponse);
  },

  /**
   * Create user with password hashing
   */
  async createUser(data) {
    const hashedPassword = await this.hashPassword(data.password);
    const [result] = await db
      .insert(users)
      .values({
        ...data,
        password: hashedPassword,
      })
      .returning();
    return mapResponse(result);
  },

  /**
   * Helper: Hash password
   */
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  },

  /**
   * Helper: Compare password
   */
  async matchPassword(enteredPassword, hashedPassword) {
    return await bcrypt.compare(enteredPassword, hashedPassword);
  }
};

export default UserRepository;
