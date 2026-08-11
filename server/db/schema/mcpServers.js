import { pgTable, varchar, jsonb, timestamp, index, uniqueIndex, text } from 'drizzle-orm/pg-core';
import { mySchema, timestampCoerced } from './_base.js';
import { sql } from 'drizzle-orm';

export const mcpServers = mySchema.table(
  'mcp_servers',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull().unique(),
    label: varchar('label', { length: 255 }).notNull(),
    description: text('description'),
    type: varchar('type', { length: 50 }).notNull().default('stdio'),
    stdioConfig: jsonb('stdio_config').notNull().default({}),
    httpConfig: jsonb('http_config').notNull().default({}),
    tools: jsonb('tools').notNull().default([]),
    resources: jsonb('resources').notNull().default([]),
    prompts: jsonb('prompts').notNull().default([]),
    runtime: jsonb('runtime').notNull().default({}),
    status: varchar('status', { length: 50 }).notNull().default('INACTIVE'),
    organizationId: varchar('organization_id', { length: 255 }),
    createdBy: varchar('created_by', { length: 255 }),
    createdAt: timestampCoerced('created_at').notNull().default(sql`now()`),
    updatedAt: timestampCoerced('updated_at').notNull().default(sql`now()`),
  },
  (table) => ({
    nameIdx: index('mcp_name_idx').on(table.name),
    statusIdx: index('mcp_status_idx').on(table.status),
    orgIdIdx: index('mcp_org_idx').on(table.organizationId),
  })
);
