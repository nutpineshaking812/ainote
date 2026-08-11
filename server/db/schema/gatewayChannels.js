import { varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { mySchema } from './_base.js';
import { channelStatusEnum } from './_enums.js';

export const gatewayChannels = mySchema.table('gateway_channels', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  providerId: text('provider_id').notNull(), 
  config: jsonb('config').notNull().default({}), 
  appId: varchar('app_id', { length: 255 }), 
  organizationId: varchar('organization_id', { length: 255 }).notNull(),
  employeeId: text('employee_id'),
  status: channelStatusEnum('status').default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
