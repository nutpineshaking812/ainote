import { db } from '../db/index.js';
import { applications } from '../db/schema/index.js';
import { eq, and, sql, desc, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

class ApplicationRepository {
  async findById(id) {
    if (!id) return null;
    const [result] = await db.select().from(applications).where(eq(applications.id, id));
    return result || null;
  }

  async findByOrganization(organizationId) {
    return db
      .select()
      .from(applications)
      .where(and(eq(applications.organizationId, organizationId), eq(applications.isDeleted, false)))
      .orderBy(desc(applications.createdAt));
  }

  async findByOwner(userId, organizationId) {
    return db
      .select()
      .from(applications)
      .where(and(eq(applications.owner, userId), eq(applications.organizationId, organizationId), eq(applications.isDeleted, false)))
      .orderBy(desc(applications.createdAt));
  }

  async create(data) {
    const id = data.id || uuidv4();
    const [result] = await db
      .insert(applications)
      .values({
        id,
        name: data.name,
        description: data.description,
        icon: data.icon,
        iconColor: data.iconColor,
        owner: data.owner.toString(),
        organizationId: data.organizationId.toString(),
        metadata: data.metadata || {},
      })
      .returning();
    return result;
  }

  async update(id, data) {
    const [result] = await db
      .update(applications)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(applications.id, id))
      .returning();
    return result;
  }

  async delete(id) {
    return db.update(applications).set({ isDeleted: true, updatedAt: new Date() }).where(eq(applications.id, id));
  }
  
  async find(query = {}) {
    // Basic implementation for compatibility
    const filters = [eq(applications.isDeleted, false)];
    if (query.organizationId) filters.push(eq(applications.organizationId, query.organizationId.toString()));
    if (query.owner) filters.push(eq(applications.owner, query.owner.toString()));
    
    return db.select().from(applications).where(and(...filters));
  }
}

export default new ApplicationRepository();
