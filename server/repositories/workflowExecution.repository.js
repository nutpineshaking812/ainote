import { eq, and, desc, sql, count } from 'drizzle-orm';
import { db } from '../db/index.js';
import { workflowExecutions } from '../db/schema/index.js';
import { mapResponse } from '../db/utils.js';
import { createBaseRepository } from './base.repository.js';

/**
 * WorkflowExecution Repository
 * Tracks the status and results of workflow runs.
 */
export const WorkflowExecutionRepository = {
  ...createBaseRepository(workflowExecutions),

  /**
   * Advanced search for executions with object-based filters and options.
   */
  async find(filter = {}, options = {}) {
    const { organizationId, workflowId, status, resourceId, resourceType, appId, sessionId } = filter;
    const { limit = 20, offset = 0 } = options;

    let query = db.select().from(workflowExecutions);
    const conditions = [];

    if (organizationId) conditions.push(eq(workflowExecutions.organizationId, organizationId.toString()));
    if (workflowId) conditions.push(eq(workflowExecutions.workflowId, workflowId.toString()));
    if (status) conditions.push(eq(workflowExecutions.status, status));
    if (resourceId) conditions.push(eq(workflowExecutions.resourceId, resourceId));
    if (resourceType) conditions.push(eq(workflowExecutions.resourceType, resourceType));
    if (appId) conditions.push(eq(workflowExecutions.appId, appId.toString()));
    
    if (sessionId) {
      conditions.push(sql`${workflowExecutions.triggerData}->>'sessionId' = ${sessionId}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const [executions, countResult] = await Promise.all([
      query
        .orderBy(desc(workflowExecutions.createdAt))
        .limit(parseInt(limit || 20))
        .offset(parseInt(offset || 0)),
      
      db
        .select({ value: count() })
        .from(workflowExecutions)
        .where(conditions.length > 0 ? and(...conditions) : sql`TRUE`)
    ]);

    return { 
      executions: mapResponse(executions), 
      total: countResult[0]?.value || 0 
    };
  },

  /**
   * Aggregated count for statistics
   */
  async countByCriteria(workflowId = null, createdAtGte = null) {
    let query = db.select({ value: count() }).from(workflowExecutions);
    const conditions = [];

    if (workflowId) conditions.push(eq(workflowExecutions.workflowId, workflowId));
    if (createdAtGte) conditions.push(sql`${workflowExecutions.createdAt} >= ${createdAtGte}`);

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const [result] = await query;
    return result.value || 0;
  },

  /**
   * Appends a single node result atomically to the JSONB nodeResults field
   */
  async appendNodeResult(executionId, nodeId, nodeRecord) {
    if (!executionId || !nodeId) return null;
    const [result] = await db
      .update(workflowExecutions)
      .set({
        nodeResults: sql`jsonb_set(COALESCE(${workflowExecutions.nodeResults}, '{}'::jsonb), array[${nodeId}]::text[], ${JSON.stringify(nodeRecord)}::jsonb)`,
        updatedAt: new Date()
      })
      .where(eq(workflowExecutions.id, executionId.toString()))
      .returning();
    return mapResponse(result);
  }
};

export default WorkflowExecutionRepository;

