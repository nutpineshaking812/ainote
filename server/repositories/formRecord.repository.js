import { createBaseRepository } from './base.repository.js';
import { formRecords } from '../db/schema/index.js';
import { db } from '../db/index.js';
import { eq, and, or, desc, asc, count, sql } from 'drizzle-orm';
import { mapResponse } from '../db/utils.js';

const baseRepo = createBaseRepository(formRecords);

export const formRecordRepository = {
  ...baseRepo,

  /**
   * Find records for a form with pagination and filtering
   */
  async findByFormId(formId, options = {}) {
    const { limit = 10, offset = 0, sortBy = 'createdAt', order = 'desc' } = options;
    
    const results = await db
      .select()
      .from(formRecords)
      .where(eq(formRecords.formId, formId))
      .limit(limit)
      .offset(offset)
      .orderBy(order === 'asc' ? formRecords[sortBy] : desc(formRecords[sortBy]));
      
    return results.map(mapResponse);
  },

  /**
   * Count records for a form
   */
  async countByFormId(formId) {
    const [result] = await db
      .select({ value: count() })
      .from(formRecords)
      .where(eq(formRecords.formId, formId));
    return result.value;
  },

  /**
   * Find a specific record for a form
   */
  async findOneByFormAndId(formId, id) {
    const [result] = await db
      .select()
      .from(formRecords)
      .where(and(eq(formRecords.formId, formId), eq(formRecords.id, id)));
    return mapResponse(result);
  },

  async deleteByFormId(formId) {
    return db.delete(formRecords).where(eq(formRecords.formId, formId));
  },

  async deleteByAppId(appId) {
    return db.delete(formRecords).where(eq(formRecords.appId, appId));
  },

  /**
   * Check if a field value in form data is unique
   */
  async checkValueUnique(formId, fieldId, value) {
    const [existingRecord] = await db
      .select()
      .from(formRecords)
      .where(sql`${formRecords.formId} = ${formId} AND ${formRecords.data}->>${fieldId} = ${value}`)
      .limit(1);
    return !!existingRecord;
  },

  /**
   * Find a record by joint unique fields (AND relationship)
   * @param {string} formId 
   * @param {Array<{fieldId: string, value: any}>} uniqueFields - Joint unique fields list
   */
  async findConflictingRecordJoint(formId, uniqueFields) {
    if (!uniqueFields || uniqueFields.length === 0) return null;

    const andConditions = uniqueFields.map(
      ({ fieldId, value }) => sql`${formRecords.data}->>${fieldId} = ${value}`
    );

    const [existingRecord] = await db
      .select()
      .from(formRecords)
      .where(
        and(
          eq(formRecords.formId, formId),
          ...andConditions
        )
      )
      .limit(1);

    return existingRecord ? mapResponse(existingRecord) : null;
  },

  /**
   * Find records with pagination, filtering, searching and sorting
   */
  async findRecordsPaged(formId, queryParams, dataFieldIdSet, dataFields) {
    const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc', q, filters } = queryParams;
    const limitInt = parseInt(limit);
    const offset = (parseInt(page) - 1) * limitInt;
    
    const conditions = [eq(formRecords.formId, formId)];

    if (q && typeof q === 'string' && q.trim()) {
      const searchTerm = `%${q.trim()}%`;
      if (dataFields.length > 0) {
        const orConds = dataFields.map((f) => 
          sql`${formRecords.data}->>${f.id} ILIKE ${searchTerm}`
        );
        conditions.push(or(...orConds));
      }
    }

    if (filters) {
      let parsed;
      try {
        parsed = typeof filters === 'string' ? JSON.parse(filters) : filters;
      } catch (e) {}
      if (Array.isArray(parsed)) {
        parsed.forEach((flt) => {
          if (!dataFieldIdSet.has(flt.fieldId)) return;
          const fieldExpr = sql`${formRecords.data}->>${flt.fieldId}`;
          switch (flt.operator) {
            case 'ne':
              conditions.push(sql`${fieldExpr} != ${flt.value}`);
              break;
            case 'regex':
              conditions.push(sql`${fieldExpr} ~* ${flt.value}`);
              break;
            case 'in':
              const vals = Array.isArray(flt.value) ? flt.value : [flt.value];
              if (vals.length) {
                conditions.push(sql`${fieldExpr} IN ${vals}`);
              }
              break;
            case 'eq':
            default:
              conditions.push(sql`${fieldExpr} = ${flt.value}`);
              break;
          }
        });
      }
    }

    const allowedMetaSort = new Set(['createdAt', 'updatedAt', 'id']);
    let sortExpr;
    if (allowedMetaSort.has(sortBy)) {
      sortExpr = order === 'asc' ? asc(formRecords[sortBy]) : desc(formRecords[sortBy]);
    } else if (dataFieldIdSet.has(sortBy)) {
      sortExpr = order === 'asc' 
        ? sql`${formRecords.data}->>${sortBy} ASC` 
        : sql`${formRecords.data}->>${sortBy} DESC`;
    } else {
      sortExpr = desc(formRecords.createdAt);
    }

    const records = await db
      .select()
      .from(formRecords)
      .where(and(...conditions))
      .limit(limitInt)
      .offset(offset)
      .orderBy(sortExpr);

    const [countResult] = await db
      .select({ value: count() })
      .from(formRecords)
      .where(and(...conditions));

    const totalRecords = countResult.value;

    return {
      records: records.map(mapResponse),
      totalRecords,
    };
  },

  /**
   * Find distinct data results for a form
   */
  async findDistinctDataByFormId(formId) {
    const results = await db
      .select({ data: formRecords.data })
      .from(formRecords)
      .where(eq(formRecords.formId, formId));
    return results;
  },

  /**
   * Find all records for a form for exporting, completely clean of closures
   */
  async findByFormIdAll(formId, sortBy = 'createdAt', order = 'desc') {
    const results = await db
      .select()
      .from(formRecords)
      .where(eq(formRecords.formId, formId))
      .orderBy(order === 'asc' ? asc(formRecords[sortBy] || formRecords.createdAt) : desc(formRecords[sortBy] || formRecords.createdAt));
    return results.map(mapResponse);
  }
};
