import { eq, ne, and, or, inArray, sql, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { workflows } from '../db/schema/workflow.js';
import { mapResponse } from '../db/utils.js';
import { createBaseRepository } from './base.repository.js';

/**
 * Workflow Repository
 * Manages the persistence and retrieval of workflow definitions.
 * Inherits standard CRUD from BaseRepository.
 */
export const WorkflowRepository = {
  ...createBaseRepository(workflows),

  /**
   * Find workflows by their functional keys, prioritized by App scope then System scope.
   * This implements the 'Shadowing' logic where App versions override System versions.
   *
   * @param {string[]} keys - The workflow keys to search for
   * @param {string} appId - The optional application context for shadowing
   */
  async findByWorkflowKeys(keys, appId = null) {
    if (!keys || keys.length === 0) return [];

    const conditions = [inArray(workflows.workflowKey, keys)];

    // Prioritize specific AppId or SYSTEM scope
    const orConditions = [
      appId ? eq(workflows.appId, appId) : sql`${workflows.appId} IS NULL`,
      eq(workflows.scope, 'SYSTEM'),
    ];

    conditions.push(or(...orConditions));

    const results = await db
      .select()
      .from(workflows)
      .where(and(...conditions))
      // App-specific (non-null) first, then fallback to System versions
      .orderBy(sql`${workflows.appId} DESC NULLS LAST`);

    return mapResponse(results);
  },

  /**
   * Find a single workflow by key, prioritized by App scope then System scope.
   */
  async findOneByWorkflowKey(workflowKey, appId = null) {
    if (!workflowKey) return null;

    const conditions = [eq(workflows.workflowKey, workflowKey)];

    const orConditions = [
      appId ? eq(workflows.appId, appId) : sql`${workflows.appId} IS NULL`,
      eq(workflows.scope, 'SYSTEM'),
    ];

    conditions.push(or(...orConditions));

    const [result] = await db
      .select()
      .from(workflows)
      .where(and(...conditions))
      .orderBy(sql`${workflows.appId} DESC NULLS LAST`)
      .limit(1);

    return mapResponse(result);
  },

  /**
   * List all active workflows of a certain trigger type
   */
  async findActiveByTrigger(triggerType, organizationId = null) {
    const conditions = [eq(workflows.status, 'ACTIVE'), eq(workflows.triggerType, triggerType)];

    if (organizationId) {
      conditions.push(eq(workflows.organizationId, organizationId));
    }

    const results = await db
      .select()
      .from(workflows)
      .where(and(...conditions));
    return mapResponse(results);
  },

  /**
   * Find workflows by organization with explicit filters.
   */
  async findByOrganization(organizationId, options = {}) {
    const { status, triggerType, workflowKey, appId, scope, limit, offset, category } = options;
    const conditions = [];

    if (organizationId) {
      conditions.push(eq(workflows.organizationId, organizationId));
    } else {
      conditions.push(sql`${workflows.organizationId} IS NULL`);
    }

    if (status) conditions.push(eq(workflows.status, status));
    if (triggerType) conditions.push(eq(workflows.triggerType, triggerType));
    if (workflowKey) conditions.push(eq(workflows.workflowKey, workflowKey));
    if (appId) conditions.push(eq(workflows.appId, appId));
    if (category) conditions.push(eq(workflows.category, category));

    if (scope) {
      if (typeof scope === 'object' && scope.$ne) {
        conditions.push(ne(workflows.scope, scope.$ne));
      } else {
        conditions.push(eq(workflows.scope, scope));
      }
    }

    let query = db
      .select()
      .from(workflows)
      .where(and(...conditions))
      .orderBy(desc(workflows.updatedAt));

    if (limit) query = query.limit(limit);
    if (offset) query = query.offset(offset);

    const results = await query;
    return mapResponse(results);
  },

  /**
   * Advanced lookup by organization and tags (for AI Capability discovery).
   * Explicit positional parameters for better intuition.
   */
  async findAvailableByOrgAndTags(orgIds, triggerType, tags = []) {
    if (!orgIds || orgIds.length === 0) return [];

    const finalTags = Array.isArray(tags) ? tags : [tags];
    const conditions = [
      eq(workflows.status, 'ACTIVE'),
      eq(workflows.triggerType, triggerType),
      inArray(workflows.organizationId, orgIds),
    ];

    if (finalTags.length > 0) {
      // JSONB Array Overlap Check
      conditions.push(
        sql`${workflows.triggerConfig}->'matchTags' ?| ARRAY[${sql.join(
          finalTags.map((t) => sql`${t}`),
          sql`,`,
        )}]::text[]`,
      );
    }

    const results = await db
      .select()
      .from(workflows)
      .where(and(...conditions));
    return mapResponse(results);
  },

  /**
   * Find active workflows containing a specific plugin node
   */
  async findActiveByPlugin(pluginId) {
    if (!pluginId) return [];

    const results = await db
      .select()
      .from(workflows)
      .where(
        and(
          eq(workflows.status, 'ACTIVE'),
          sql`${workflows.nodes} @> ${JSON.stringify([{ data: { pluginId } }])}::jsonb`,
        ),
      );
    return mapResponse(results);
  },

  /**
   * Custom list for skills with explicit scope parameters.
   */
  async findAvailableSkills(orgId = null, appId = null, scope = null) {
    const baseConditions = [eq(workflows.isSkill, true), eq(workflows.status, 'ACTIVE')];

    let scopeConditions = [];
    if (!scope || scope === 'ORGANIZATION') {
      if (orgId)
        scopeConditions.push(
          and(eq(workflows.scope, 'ORGANIZATION'), eq(workflows.organizationId, orgId)),
        );
    }
    if (!scope || scope === 'APP') {
      if (appId) scopeConditions.push(and(eq(workflows.scope, 'APP'), eq(workflows.appId, appId)));
    }

    if (scopeConditions.length === 0 && !scope) return [];

    const finalConditions = and(...baseConditions, or(...scopeConditions));
    const results = await db.select().from(workflows).where(finalConditions);
    return mapResponse(results);
  },
};

export default WorkflowRepository;
