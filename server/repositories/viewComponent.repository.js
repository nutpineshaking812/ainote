import { db } from '../db/index.js';
import { viewComponents } from '../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { mapResponse } from '../db/utils.js';

class ViewComponentRepository {
  async findById(id) {
    const results = await db
      .select()
      .from(viewComponents)
      .where(eq(viewComponents.id, id))
      .limit(1);
    return mapResponse(results[0]);
  }

  async find(options = {}) {
    const query = db.select().from(viewComponents);
    
    if (options.where) {
      query.where(options.where(viewComponents, { eq, and, sql }));
    }
    
    if (options.limit) query.limit(options.limit);
    if (options.offset) query.offset(options.offset);
    
    if (options.orderBy) {
      query.orderBy(options.orderBy(viewComponents, { sql, desc: (col) => sql`${col} DESC`, asc: (col) => sql`${col} ASC` }));
    } else {
      query.orderBy(sql`${viewComponents.updatedAt} DESC`);
    }
    
    const results = await query;
    return mapResponse(results);
  }

  async findOne(options = {}) {
    const query = db.select().from(viewComponents);
    if (options.where) {
      query.where(options.where(viewComponents, { eq, and, sql }));
    }
    const results = await query.limit(1);
    return mapResponse(results[0]);
  }

  async create(data) {
    const results = await db
      .insert(viewComponents)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .returning();
    return mapResponse(results[0]);
  }

  async update(id, data) {
    const results = await db
      .update(viewComponents)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(viewComponents.id, id))
      .returning();
    return mapResponse(results[0]);
  }

  async delete(id) {
    await db.delete(viewComponents).where(eq(viewComponents.id, id));
    return true;
  }

  async deleteByOwnerId(ownerId) {
    await db.delete(viewComponents).where(eq(viewComponents.ownerId, ownerId.toString()));
    return true;
  }
}

export default new ViewComponentRepository();
