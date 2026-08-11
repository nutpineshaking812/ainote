import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { chatConversations } from '../db/schema/chatConversations.js';
import { mapResponse } from '../db/utils.js';
import { createBaseRepository } from './base.repository.js';

/**
 * Chat Conversation Repository
 * Manages chat session metadata.
 */
export const ChatConversationRepository = {
  ...createBaseRepository(chatConversations),

  /**
   * Find conversations for a specific user within an app
   */
  async findByUserAndApp(userId, appId, opts = {}) {
    if (!userId) return [];
    
    // Support passing limit directly as a number for backward compatibility
    const options = typeof opts === 'number' ? { limit: opts } : opts;
    const { limit = 50, targetId, employeeId, scenario } = options;
    
    const conditions = [eq(chatConversations.userId, userId)];
    if (appId) {
      conditions.push(eq(chatConversations.appId, appId));
    }
    if (scenario) {
      conditions.push(eq(chatConversations.scenario, scenario));
    }
    if (targetId) {
      conditions.push(eq(chatConversations.targetId, targetId));
    }
    if (employeeId) {
      conditions.push(eq(chatConversations.employeeId, employeeId));
    }

    const results = await db
      .select()
      .from(chatConversations)
      .where(and(...conditions))
      .orderBy(desc(chatConversations.updatedAt))
      .limit(limit);
      
    return mapResponse(results);
  },

  /**
   * Quick update of conversation title
   */
  async updateTitle(id, title) {
    return this.update(id, { title });
  }
};

export default ChatConversationRepository;
