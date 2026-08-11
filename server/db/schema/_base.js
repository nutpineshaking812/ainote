import { pgSchema, customType } from 'drizzle-orm/pg-core';

/**
 * Base Schema Definition
 * All platform-specific tables should reside in the 'lc' schema for isolation,
 * managed centrally through this exported 'mySchema' object.
 */
export const mySchema = pgSchema("lc");

/**
 * Smart Timestamp with Auto-Coercion
 * Automatically converts string-formatted dates (ISO strings from Temporal/Frontend) 
 * into native Javascript Date objects before database insertion.
 */
export const timestampCoerced = customType({
  dataType() {
    return 'timestamp with time zone';
  },
  toDriver(value) {
    if (typeof value === 'string') return new Date(value);
    return value;
  },
  fromDriver(value) {
    // When reading from PG driver, it's already a Date object if the column is timestamp
    return value;
  },
});

