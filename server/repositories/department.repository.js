import { db } from '../db/index.js';
import { departments } from '../db/schema/index.js';
import { eq, and, or, inArray, asc } from 'drizzle-orm';

class DepartmentRepository {
  async findById(id) {
    if (!id) return null;
    const results = await db.select().from(departments).where(eq(departments.id, id)).limit(1);
    return results[0] || null;
  }

  async findByOrganization(organizationId) {
    return await db
      .select()
      .from(departments)
      .where(eq(departments.organizationId, organizationId))
      .orderBy(asc(departments.order));
  }

  async findAll(ids) {
    if (!ids || ids.length === 0) return [];
    return await db.select().from(departments).where(inArray(departments.id, ids));
  }

  async create(data) {
    const results = await db.insert(departments).values(data).returning();
    return results[0];
  }

  async update(id, data) {
    const results = await db
      .update(departments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(departments.id, id))
      .returning();
    return results[0];
  }

  async delete(id) {
    return await db.delete(departments).where(eq(departments.id, id)).returning();
  }
}

export default new DepartmentRepository();
