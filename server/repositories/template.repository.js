import { db } from '../db/index.js';
import { templates } from '../db/schema/index.js';
import { eq, and, sql, desc, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

class TemplateRepository {
  async findById(id) {
    const [result] = await db.select().from(templates).where(eq(templates.id, id));
    return result || null;
  }

  async findAvailable(userId, appId = null) {
    const filters = [
      or(
        and(eq(templates.scope, 'personal'), eq(templates.createdBy, userId.toString())),
        appId ? eq(templates.appId, appId.toString()) : sql`FALSE`
      )
    ];
    
    return db
      .select()
      .from(templates)
      .where(and(...filters))
      .orderBy(desc(templates.updatedAt));
  }

  async create(data) {
    const id = data.id || uuidv4();
    const [result] = await db
      .insert(templates)
      .values({
        id,
        name: data.name,
        description: data.description,
        blocks: data.blocks || [],
        contentPlain: data.contentPlain || '',
        tags: data.tags || [],
        type: data.type || 'document',
        scope: data.scope || 'personal',
        appId: data.appId?.toString(),
        createdBy: data.createdBy.toString(),
        updatedBy: data.updatedBy.toString(),
      })
      .returning();
    return result;
  }

  async update(id, data) {
    const [result] = await db
      .update(templates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(templates.id, id))
      .returning();
    return result;
  }

  async delete(id) {
    return db.delete(templates).where(eq(templates.id, id));
  }
}

export default new TemplateRepository();
