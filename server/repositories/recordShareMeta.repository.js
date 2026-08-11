import { db } from '../db/index.js';
import { recordShareMeta } from '../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { mapResponse } from '../db/utils.js';

class RecordShareMetaRepository {
  async findOne(options = {}) {
    const query = db.select().from(recordShareMeta);
    
    if (options.where) {
      query.where(options.where(recordShareMeta, { eq, and }));
    }
    
    const results = await query.limit(1);
    return mapResponse(results[0]);
  }

  async findByRecordId(recordId) {
    const results = await db
      .select()
      .from(recordShareMeta)
      .where(eq(recordShareMeta.recordId, recordId.toString()))
      .limit(1);
    return mapResponse(results[0]);
  }

  async find(options = {}) {
    const query = db.select().from(recordShareMeta);
    
    if (options.where) {
      query.where(options.where(recordShareMeta, { eq, and }));
    }
    
    if (options.limit) {
      query.limit(options.limit);
    }
    
    if (options.offset) {
      query.offset(options.offset);
    }
    
    query.orderBy(sql`${recordShareMeta.createdAt} DESC`);
    
    const results = await query;
    return mapResponse(results);
  }

  async count(options = {}) {
    const query = db.select({ count: sql`count(*)` }).from(recordShareMeta);
    
    if (options.where) {
      query.where(options.where(recordShareMeta, { eq, and }));
    }
    
    const results = await query;
    return parseInt(results[0].count);
  }

  async create(data) {
    const results = await db
      .insert(recordShareMeta)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .returning();
    return mapResponse(results[0]);
  }

  async update(id, data) {
    const results = await db
      .update(recordShareMeta)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(recordShareMeta.id, id))
      .returning();
    return mapResponse(results[0]);
  }

  async delete(id) {
    await db.delete(recordShareMeta).where(eq(recordShareMeta.id, id));
    return true;
  }

  async deleteByRecordId(recordId) {
    await db.delete(recordShareMeta).where(eq(recordShareMeta.recordId, recordId.toString()));
    return true;
  }

  async deleteByFormId(formId) {
    await db.delete(recordShareMeta).where(eq(recordShareMeta.formId, formId.toString()));
    return true;
  }
}

export default new RecordShareMetaRepository();
