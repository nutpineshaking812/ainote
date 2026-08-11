import { db } from '../db/index.js';
import { orgWidgets } from '../db/schema/index.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

class OrgWidgetRepository {
  async findById(id) {
    const [result] = await db.select().from(orgWidgets).where(eq(orgWidgets.id, id));
    return result || null;
  }

  async findByOrg(orgId, status = null) {
    const filters = [eq(orgWidgets.orgId, orgId.toString())];
    if (status) {
      filters.push(eq(orgWidgets.status, status));
    }
    
    return db
      .select()
      .from(orgWidgets)
      .where(and(...filters))
      .orderBy(desc(orgWidgets.priority), desc(orgWidgets.createdAt));
  }

  async create(data) {
    const id = data.id || uuidv4();
    const [result] = await db
      .insert(orgWidgets)
      .values({
        id,
        orgId: data.orgId.toString(),
        title: data.title,
        icon: data.icon,
        type: data.type || 'form',
        config: data.config || {},
        visibleToRoles: data.visibleToRoles || [],
        visibleToDepartments: data.visibleToDepartments || [],
        status: data.status || 'ACTIVE',
        priority: data.priority || 0,
      })
      .returning();
    return result;
  }

  async update(id, data) {
    const [result] = await db
      .update(orgWidgets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(orgWidgets.id, id))
      .returning();
    return result;
  }

  async delete(id) {
    return db.delete(orgWidgets).where(eq(orgWidgets.id, id));
  }
}

export default new OrgWidgetRepository();
