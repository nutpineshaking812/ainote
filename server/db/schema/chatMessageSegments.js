import { varchar, jsonb, index, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { mySchema, timestampCoerced } from './_base.js';
import { chatMessageSegmentTypeEnum } from './_enums.js';

/**
 * Chat Message Segments Table
 * Stores the actual content of a message, split into segments (Text, Thought, Tool Result, etc.)
 * This enables high-performance streaming and efficient storage of large datasets.
 */
export const chatMessageSegments = mySchema.table('chat_message_segments', {
  id: varchar('id', { length: 255 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  messageId: varchar('message_id', { length: 255 }).notNull(),
  
  // Segment type (e.g., 'Response', 'thought', 'tool_result', 'chart_data')
  type: chatMessageSegmentTypeEnum('type').notNull(),
  
  // Actual content (supports text or JSON objects)
  content: jsonb('content'),
  
  // Whether this segment should be hidden from the end-user (UI)
  hidden: boolean('hidden').default(false),

  // Metadata field (stores sql, prompt metadata, or other structural fields)
  meta: jsonb('meta'),

  createdAt: timestampCoerced('created_at').default(sql`now()`),
}, (table) => ({
  messageIdx: index('chat_seg_message_idx').on(table.messageId),
}));
