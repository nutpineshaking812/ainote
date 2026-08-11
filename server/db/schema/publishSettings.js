import { varchar, timestamp, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';
import crypto from 'crypto';
import { mySchema } from './_base.js';

export const publishSettings = mySchema.table(
  'publish_settings',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    formId: varchar('form_id', { length: 255 }).notNull(),
    appId: varchar('app_id', { length: 255 }).notNull(),
    organizationId: varchar('organization_id', { length: 255 }),

    // Public form fill configuration
    fillLink: jsonb('fill_link').default({
      isPublic: false,
      useAccessCode: false,
      accessCodeHash: '',
      accessCodePlain: '',
      useLinkExpiry: false,
      linkExpiresAt: null,
    }).notNull(),

    // Global record share defaults
    recordShare: jsonb('record_share').default({
      isPublic: false,
      defaultFieldPermissions: {},
      defaultExpiryHours: null,
    }).notNull(),

    // Public query configuration
    queryLink: jsonb('query_link').default({
      isPublic: false,
      useAccessCode: false,
      accessCodeHash: '',
      accessCodePlain: '',
      useLinkExpiry: false,
      linkExpiresAt: null,
      fieldPermissions: {},
    }).notNull(),

    // External API integration
    externalApi: jsonb('external_api').default({
      enabled: false,
      tokens: [],
    }).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      uniqueFormIdx: uniqueIndex('publish_settings_form_id_idx').on(table.formId),
    };
  },
);
