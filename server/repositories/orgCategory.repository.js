import { db } from '../db/index.js';
import { orgCategories } from '../db/schema/index.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

class OrgCategoryRepository {
  async findById(id) {
    const [result] = await db.select().from(orgCategories).where(eq(orgCategories.id, id));
    return result || null;
  }

  async findByOrg(organizationId, scope = 'organization') {
    return db
      .select()
      .from(orgCategories)
      .where(and(eq(orgCategories.organizationId, organizationId.toString()), eq(orgCategories.scope, scope)))
      .orderBy(desc(orgCategories.createdAt));
  }

  async findByKey(organizationId, key) {
    const [result] = await db
      .select()
      .from(orgCategories)
      .where(and(eq(orgCategories.organizationId, organizationId.toString()), eq(orgCategories.key, key)));
    return result || null;
  }

  async create(data) {
    const id = data.id || uuidv4();
    const [result] = await db
      .insert(orgCategories)
      .values({
        id,
        organizationId: data.organizationId.toString(),
        key: data.key,
        label: data.label,
        icon: data.icon,
        color: data.color,
        description: data.description,
        isSystem: data.isSystem || false,
        scope: data.scope || 'organization',
        createdBy: data.createdBy?.toString(),
      })
      .returning();
    return result;
  }

  async update(id, data) {
    const [result] = await db
      .update(orgCategories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(orgCategories.id, id))
      .returning();
    return result;
  }

  async delete(id) {
    return db.delete(orgCategories).where(eq(orgCategories.id, id));
  }
}

export default new OrgCategoryRepository();
