import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { mapResponse } from '../db/utils.js';

/**
 * Base Repository Factory
 * Provides standard CRUD operations for Drizzle tables with built-in multitenancy support (orgId).
 * 
 * @param {import('drizzle-orm/pg-core').PgTable} table - The Drizzle table object
 * @returns {Object} Standard CRUD methods
 */
export const createBaseRepository = (table) => ({
  /**
   * Find a single record with flexible conditions
   */
  async findOne(options = {}) {
    const { where, order, tx } = options;
    const drizzle = await import('drizzle-orm');
    const executor = tx || db;
    
    let query = executor.select().from(table);
    
    if (where && typeof where === 'function') {
      query = query.where(where(table, drizzle));
    }
    
    if (order && typeof order === 'function') {
      query = query.orderBy(...order(table, drizzle));
    }
    
    const [result] = await query.limit(1);
    return mapResponse(result);
  },

  /**
   * Find a record by ID with optional orgId isolation
   */
  async findById(id, organizationId = null, tx = null) {
    if (!id) return null;
    
    const executor = tx || db;
    const conditions = [];
    
    // 如果 id 是对象，假设它是复合主键
    if (typeof id === 'object' && !(id instanceof Date)) {
      Object.keys(id).forEach(key => {
        if (table[key]) {
          conditions.push(eq(table[key], id[key]));
        }
      });
    } else if (table.id) {
      conditions.push(eq(table.id, id));
    }

    if (conditions.length === 0) return null;

    if (organizationId && table.organizationId) {
      conditions.push(eq(table.organizationId, organizationId));
    }

    try {
      const [result] = await executor.select().from(table).where(and(...conditions));
      return mapResponse(result);
    } catch (err) {
      return null;
    }
  },

  /**
   * Find all records with optional filtering
   */
  async findAll(options = {}) {
    const { where, order, limit, offset, tx } = options;
    const drizzle = await import('drizzle-orm');
    const executor = tx || db;
    
    let query = executor.select().from(table);
    
    if (where && typeof where === 'function') {
      query = query.where(where(table, drizzle));
    }
    
    if (order && typeof order === 'function') {
      query = query.orderBy(...order(table, drizzle));
    }

    if (limit) query = query.limit(limit);
    if (offset) query = query.offset(offset);
    
    const results = await query;
    return results.map(mapResponse);
  },

  /**
   * Simple create
   */
  async create(data, tx = null) {
    const executor = tx || db;
    const [result] = await executor.insert(table).values(data).returning();
    return mapResponse(result);
  },

  /**
   * Update by ID with optional orgId isolation
   * Supports: 
   * - update(id, organizationId, data)
   * - update(id, data) -> when data is an object and no 3rd arg
   */
  async update(id, organizationId, data, tx = null) {
    if (!id) return null;

    let finalOrgId = organizationId;
    let finalData = data;
    let finalTx = tx;

    if (data === undefined && typeof organizationId === 'object') {
      finalData = organizationId;
      finalOrgId = null;
    }

    const executor = finalTx || db;
    const conditions = [];
    
    // 支持复合主键 (ID 是对象)
    if (typeof id === 'object' && !(id instanceof Date)) {
      Object.keys(id).forEach(key => {
        if (table[key]) {
          conditions.push(eq(table[key], id[key]));
        }
      });
    } else if (table.id) {
      conditions.push(eq(table.id, id));
    }

    if (conditions.length === 0) return null;

    if (finalOrgId && table.organizationId) {
      conditions.push(eq(table.organizationId, finalOrgId));
    }

    const [result] = await executor
      .update(table)
      .set({ ...finalData, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
      
    return mapResponse(result);
  },


  /**
   * Delete by ID with optional orgId isolation
   */
  async delete(id, organizationId = null, tx = null) {
    if (!id) return false;

    const executor = tx || db;
    const conditions = [];
    if (typeof id === 'object' && !(id instanceof Date)) {
      Object.keys(id).forEach(key => {
        if (table[key]) {
          conditions.push(eq(table[key], id[key]));
        }
      });
    } else if (table.id) {
      conditions.push(eq(table.id, id));
    }

    if (conditions.length === 0) return false;

    if (organizationId && table.organizationId) {
      conditions.push(eq(table.organizationId, organizationId));
    }

    const [result] = await executor.delete(table).where(and(...conditions)).returning();
    return !!result;
  },

  /**
   * Count records with optional filtering
   */
  async count(options = {}) {
    const { where, tx } = options;
    const drizzle = await import('drizzle-orm');
    const { count: drizzleCount } = drizzle;
    const executor = tx || db;
    
    let query = executor.select({ value: drizzleCount() }).from(table);
    
    if (where && typeof where === 'function') {
      query = query.where(where(table, drizzle));
    }
    
    const [result] = await query;
    return result.value;
  }
});
