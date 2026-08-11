import { db } from '../db/index.js';
import { roles } from '../db/schema/index.js';
import { eq, and, or, inArray, asc } from 'drizzle-orm';

class RoleRepository {
  async findById(id) {
    if (!id) return null;
    const results = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    return results[0] || null;
  }

  async findByOrganization(organizationId, filter = {}) {
    let query = db.select().from(roles).where(eq(roles.organizationId, organizationId));
    
    const conditions = [eq(roles.organizationId, organizationId)];
    
    if (filter.scope) {
      conditions.push(eq(roles.scope, filter.scope));
    }
    
    if (filter.appId) {
      conditions.push(eq(roles.appId, filter.appId));
    }

    return await db
      .select()
      .from(roles)
      .where(and(...conditions))
      .orderBy(asc(roles.createdAt));
  }

  async findByKeys(organizationId, keys) {
    if (!keys || keys.length === 0) return [];
    return await db
      .select()
      .from(roles)
      .where(
        and(
          eq(roles.organizationId, organizationId),
          inArray(roles.key, keys)
        )
      );
  }

  async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    return await db.select().from(roles).where(inArray(roles.id, ids));
  }

  async findOne(filter) {
    const conditions = [];
    if (filter.organizationId) conditions.push(eq(roles.organizationId, filter.organizationId));
    if (filter.key) conditions.push(eq(roles.key, filter.key));
    if (filter.name) conditions.push(eq(roles.name, filter.name));
    if (filter.scope) conditions.push(eq(roles.scope, filter.scope));
    if (filter.appId) conditions.push(eq(roles.appId, filter.appId));

    if (conditions.length === 0) return null;

    const results = await db
      .select()
      .from(roles)
      .where(and(...conditions))
      .limit(1);
    
    return results[0] || null;
  }

  async create(data) {
    const results = await db.insert(roles).values(data).returning();
    return results[0];
  }

  async batchCreate(dataList) {
    if (!dataList || dataList.length === 0) return [];
    return await db.insert(roles).values(dataList).returning();
  }

  async update(id, data) {
    const results = await db
      .update(roles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(roles.id, id))
      .returning();
    return results[0];
  }

  async delete(id) {
    return await db.delete(roles).where(eq(roles.id, id)).returning();
  }

  async deleteMany(filter) {
    const conditions = [];
    if (filter.organizationId) conditions.push(eq(roles.organizationId, filter.organizationId));
    if (filter.scope) conditions.push(eq(roles.scope, filter.scope));
    if (filter.appId) conditions.push(eq(roles.appId, filter.appId));

    if (conditions.length === 0) return [];

    return await db.delete(roles).where(and(...conditions)).returning();
  }
}

export default new RoleRepository();
