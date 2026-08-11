import { varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { mySchema } from './_base.js';
import { bindingStatusEnum } from './_enums.js';

export const gatewayWorkflowBindings = mySchema.table('gateway_workflow_bindings', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),

  workflowId: varchar('workflow_id', { length: 255 }).notNull(), 
  targetSessionId: varchar('target_session_id', { length: 255 }), // Bound to a specific chat session
  cron: varchar('cron', { length: 255 }),
  
  triggerConfig: jsonb('trigger_config').notNull().default({}), 
  
  status: bindingStatusEnum('status').default('ENABLED'),
  organizationId: varchar('organization_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
