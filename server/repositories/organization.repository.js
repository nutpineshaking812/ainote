import { db } from '../db/index.js';
import { organizations } from '../db/schema/index.js';
import { eq, and, or, inArray, ilike } from 'drizzle-orm';

class OrganizationRepository {
  async findById(id) {
    if (!id) return null;
    const results = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    return results[0] || null;
  }

  async findByOwnerId(ownerId) {
    return await db.select().from(organizations).where(eq(organizations.ownerId, ownerId));
  }

  async findAll(ids) {
    if (!ids || ids.length === 0) return [];
    return await db.select().from(organizations).where(inArray(organizations.id, ids));
  }

  async create(data) {
    const results = await db.insert(organizations).values(data).returning();
    return results[0];
  }

  async update(id, data) {
    const results = await db
      .update(organizations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return results[0];
  }

  async delete(id) {
    const results = await db
      .update(organizations)
      .set({ status: 'DELETED', updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return results[0];
  }

  async findPersonalOrg(userId) {
    const results = await db
      .select()
      .from(organizations)
      .where(
        and(
          eq(organizations.ownerId, userId),
          eq(organizations.type, 'PERSONAL')
        )
      )
      .limit(1);
    return results[0] || null;
  }
}

export default new OrganizationRepository();
