import { varchar, text, boolean, jsonb, pgEnum, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { mySchema, timestampCoerced } from './_base.js';

/**
 * Workflow Blueprint Table
 * Stores the design and configuration of a workflow.
 */
export const workflows = mySchema.table('workflows', {
  id: varchar('id', { length: 255 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar('name', { length: 255 }).notNull(),
  workflowKey: varchar('workflow_key', { length: 255 }), // System-level identifier
  description: text('description'),
  organizationId: varchar('organization_id', { length: 255 }),
  appId: varchar('app_id', { length: 255 }),
  scope: varchar('scope', { length: 50 }).default('APP'), // APP, ORGANIZATION, SYSTEM
  category: varchar('category', { length: 50 }).default('GENERAL'), // GENERAL, AI_MEMORY_RECALL, etc.
  isSkill: boolean('is_skill').default(false),
  skillConfig: jsonb('skill_config').default({}),
  nodes: jsonb('nodes').default([]),
  edges: jsonb('edges').default([]),
  status: varchar('status', { length: 20 }).default('INACTIVE'), // ACTIVE, INACTIVE
  triggerType: varchar('trigger_type', { length: 50 }).notNull(),
  triggerConfig: jsonb('trigger_config').default({}),
  lastRunAt: timestampCoerced('last_run_at'),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestampCoerced('created_at').default(sql`now()`),
  updatedAt: timestampCoerced('updated_at')
    .default(sql`now()`)
    .$onUpdate(() => new Date()),
});
