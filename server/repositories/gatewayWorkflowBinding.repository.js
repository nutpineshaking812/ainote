import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { mapResponse } from '../db/utils.js';
import { gatewayWorkflowBindings } from '../db/schema/index.js';
import { createBaseRepository } from './base.repository.js';

const baseRepo = createBaseRepository(gatewayWorkflowBindings);

/**
 * Workflow Binding Repository
 * Manages subscriptions and scheduled execution contexts.
 */
export const GatewayWorkflowBindingRepository = {
  ...baseRepo,

  /**
   * Find all active bindings for a specific session
   */
  async findBySession(sessionId) {
    const results = await db
      .select()
      .from(gatewayWorkflowBindings)
      .where(
        and(
          eq(gatewayWorkflowBindings.targetSessionId, sessionId),
          eq(gatewayWorkflowBindings.status, 'ENABLED'),
        ),
      );
    return results.map(mapResponse);
  },

  /**
   * Find all active bindings for a specific workflow
   */
  async findByWorkflow(workflowId) {
    const results = await db
      .select()
      .from(gatewayWorkflowBindings)
      .where(
        and(
          eq(gatewayWorkflowBindings.workflowId, workflowId),
          eq(gatewayWorkflowBindings.status, 'ENABLED'),
        ),
      );
    return results.map(mapResponse);
  },

  /**
   * Find all enabled bindings for background scheduling
   */
  async findAllEnabled() {
    const results = await db
      .select()
      .from(gatewayWorkflowBindings)
      .where(eq(gatewayWorkflowBindings.status, 'ENABLED'));
    return results.map(mapResponse);
  },
};

export default GatewayWorkflowBindingRepository;
