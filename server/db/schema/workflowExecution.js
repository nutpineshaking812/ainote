import { pgTable, uuid, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { workflows } from './workflow.js';
import { mySchema, timestampCoerced } from './_base.js';

/**
 * Workflow Execution Instance Table
 * Stores the results and state of individual workflow runs.
 */
export const workflowExecutions = mySchema.table('workflow_executions', {
  id: varchar('id', { length: 255 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workflowId: varchar('workflow_id', { length: 255 }).notNull(), // Can be UUID or system_KEY
  organizationId: varchar('organization_id', { length: 255 }),
  status: varchar('status', { length: 20 }).default('RUNNING'), // RUNNING, SUCCESS, FAILED, CANCELLED
  temporalWorkflowId: varchar('temporal_workflow_id', { length: 255 }),
  temporalRunId: varchar('temporal_run_id', { length: 255 }),
  startTime: timestampCoerced('start_time').default(sql`now()`),
  endTime: timestampCoerced('end_time'),
  nodeResults: jsonb('node_results').default({}),
  error: jsonb('error').default({}),
  triggerData: jsonb('trigger_data').default({}),
  triggeredBy: varchar('triggered_by', { length: 255 }),
  resourceId: varchar('resource_id', { length: 255 }),
  resourceType: varchar('resource_type', { length: 255 }),
  createdAt: timestampCoerced('created_at').default(sql`now()`),
  updatedAt: timestampCoerced('updated_at')
    .default(sql`now()`)
    .$onUpdate(() => new Date()),
});
