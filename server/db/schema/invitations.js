import { pgTable, varchar, integer, timestamp, index, text } from 'drizzle-orm/pg-core';
import { mySchema, timestampCoerced } from './_base.js';
import { sql } from 'drizzle-orm';

export const invitations = mySchema.table(
  'invitations',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    code: varchar('code', { length: 255 }).notNull().unique(),
    inviter: varchar('inviter', { length: 255 }).notNull(),
    targetOrganizationId: varchar('target_organization_id', { length: 255 }),
    maxUses: integer('max_uses').notNull().default(1),
    uses: integer('uses').notNull().default(0),
    usedBy: text('used_by').array().notNull().default(sql`ARRAY[]::text[]`),
    type: varchar('type', { length: 50 }).notNull().default('PLATFORM'),
    status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
    expiresAt: timestampCoerced('expires_at'),
    createdAt: timestampCoerced('created_at').notNull().default(sql`now()`),
    updatedAt: timestampCoerced('updated_at').notNull().default(sql`now()`),
  },
  (table) => ({
    codeIdx: index('invitation_code_idx').on(table.code),
    inviterIdx: index('invitation_inviter_idx').on(table.inviter),
    orgIdIdx: index('invitation_org_idx').on(table.targetOrganizationId),
    statusIdx: index('invitation_status_idx').on(table.status),
  })
);
