import { db } from '../db/index.js';
import { views } from '../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { mapResponse } from '../db/utils.js';

class ViewRepository {
  async findById(id) {
    const results = await db
      .select()
      .from(views)
      .where(eq(views.id, id))
      .limit(1);
    return mapResponse(results[0]);
  }

  async findOne(options = {}) {
    const query = db.select().from(views);
    
    if (options.where) {
      query.where(options.where(views, { eq, and, sql }));
    }
    
    const results = await query.limit(1);
    return mapResponse(results[0]);
  }

  async findByAppId(appId) {
    const results = await db
      .select()
      .from(views)
      .where(eq(views.appId, appId.toString()))
      .orderBy(sql`${views.updatedAt} DESC`);
    return mapResponse(results);
  }

  async find(options = {}) {
    const query = db.select().from(views);
    
    if (options.where) {
      query.where(options.where(views, { eq, and, sql }));
    }
    
    if (options.orderBy) {
      query.orderBy(options.orderBy(views, { sql, desc: (col) => sql`${col} DESC`, asc: (col) => sql`${col} ASC` }));
    } else {
      query.orderBy(sql`${views.updatedAt} DESC`);
    }
    
    const results = await query;
    return mapResponse(results);
  }

  async create(data) {
    const results = await db
      .insert(views)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .returning();
    return mapResponse(results[0]);
  }

  async update(id, data) {
    const results = await db
      .update(views)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(views.id, id))
      .returning();
    return mapResponse(results[0]);
  }

  async delete(id) {
    await db.delete(views).where(eq(views.id, id));
    return true;
  }

  async deleteByAppId(appId) {
    await db.delete(views).where(eq(views.appId, appId.toString()));
    return true;
  }
}

export default new ViewRepository();
