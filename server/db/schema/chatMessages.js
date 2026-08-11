import { varchar, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { mySchema, timestampCoerced } from './_base.js';
import { chatMessageRoleEnum } from './_enums.js';

/**
 * Chat Messages Table
 * Stores the identity and metadata of each message in a conversation.
 * Content is stored separately in chat_message_segments for better scalability.
 */
export const chatMessages = mySchema.table('chat_messages', {
  id: varchar('id', { length: 255 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  conversationId: varchar('conversation_id', { length: 255 }).notNull(),
  
  // Message target/source role
  role: chatMessageRoleEnum('role').notNull().default('user'),

  // Metadata for AI response (e.g. token usage)
  responseMetadata: jsonb('response_metadata'),
  
  createdAt: timestampCoerced('created_at').default(sql`now()`),
});
