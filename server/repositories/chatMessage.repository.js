import { eq, and, asc, desc, inArray, gt, ne, notInArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { chatMessages } from '../db/schema/chatMessages.js';
import { chatMessageSegments } from '../db/schema/chatMessageSegments.js';
import { mapResponse } from '../db/utils.js';
import { createBaseRepository } from './base.repository.js';

/**
 * Chat Message Repository
 * Handles messages and their associated segments.
 */
const safeJsonb = (val) => {
  if (val === undefined || val === null) return null;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      JSON.parse(val);
      return val;
    } catch (e) {
      return JSON.stringify(val);
    }
  }
  return JSON.stringify(val);
};

export const ChatMessageRepository = {
  ...createBaseRepository(chatMessages),

  /**
   * Create a message along with its initial segments in a transaction
   */
  async createWithSegments(messageData, segments = []) {
    return await db.transaction(async (tx) => {
      // 1. Create the message
      const [msg] = await tx.insert(chatMessages).values(messageData).returning();
      const messageId = msg.id;

      // 2. Create segments if any
      let createdSegments = [];
      if (segments.length > 0) {
        const segmentPayloads = segments.map((s) => ({
          messageId,
          type: s.type,
          content: safeJsonb(s.content ?? s.text ?? null),
          createdAt: s.createdAt || new Date(),
          hidden: s.hidden ?? false,
          meta: safeJsonb(s.meta || null),
        }));
        createdSegments = await tx.insert(chatMessageSegments).values(segmentPayloads).returning();
      }

      return {
        ...mapResponse(msg),
        segments: createdSegments.map(mapResponse),
      };
    });
  },

  /**
   * Append a single segment to an existing message
   */
  async appendSegment(messageId, type, content, hidden = false, meta = null) {
    if (!messageId) throw new Error('messageId is required to append segment');
    
    const [segment] = await db
      .insert(chatMessageSegments)
      .values({
        messageId,
        type,
        content: safeJsonb(content),
        hidden,
        meta: safeJsonb(meta),
      })
      .returning();
      
    return mapResponse(segment);
  },

  /**
   * Append multiple segments at once
   */
  async appendSegments(messageId, segmentsInput = []) {
    if (!messageId || segmentsInput.length === 0) return [];

    const payloads = segmentsInput.map((s) => ({
      messageId,
      type: s.type,
      content: safeJsonb(s.content ?? s.text ?? null),
      createdAt: s.createdAt || new Date(),
      hidden: s.hidden ?? false,
      meta: safeJsonb(s.meta || null),
    }));

    const results = await db.insert(chatMessageSegments).values(payloads).returning();
    return results.map(mapResponse);
  },

  /**
   * Get recent messages for a conversation, including their segments
   */
  async findRecentWithSegments(conversationId, limit = 10, options = {}) {
    const { afterTime, includeHidden = true, excludeTypes = [] } = options;
    const conditions = [eq(chatMessages.conversationId, conversationId)];
    
    // 1. Get messages
    const msgs = await db
      .select()
      .from(chatMessages)
      .where(and(...conditions))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    if (msgs.length === 0) return [];

    // 2. Get all segments for these messages
    const messageIds = msgs.map((m) => m.id);
    const segmentConditions = [inArray(chatMessageSegments.messageId, messageIds)];

    if (!includeHidden) {
      segmentConditions.push(eq(chatMessageSegments.hidden, false));
    }
    
    if (Array.isArray(excludeTypes) && excludeTypes.length > 0) {
      segmentConditions.push(notInArray(chatMessageSegments.type, excludeTypes));
    }

    const allSegments = await db
      .select()
      .from(chatMessageSegments)
      .where(and(...segmentConditions))
      .orderBy(asc(chatMessageSegments.createdAt));
      
    // Map segments to messages
    const segmentMap = allSegments.reduce((acc, seg) => {
      if (!acc[seg.messageId]) acc[seg.messageId] = [];
      acc[seg.messageId].push(mapResponse(seg));
      return acc;
    }, {});

    return msgs.map((m) => ({
      ...mapResponse(m),
      segments: segmentMap[m.id] || [],
    })).reverse(); 
  },

  /**
   * Find a specific message by ID with all its segments pre-loaded
   */
  async findByIdWithSegments(id) {
    if (!id) return null;

    const msg = await this.findById(id);
    if (!msg) return null;

    const segments = await db
      .select()
      .from(chatMessageSegments)
      .where(eq(chatMessageSegments.messageId, id))
      .orderBy(asc(chatMessageSegments.createdAt));

    return {
      ...msg,
      segments: segments.map(mapResponse),
    };
  },

  /**
   * Find the latest segments for a conversation across all its messages.
   * Joins with chat_messages to get the role for each segment.
   */
  async findLatestSegmentsJoined(conversationId, limit = 50, options = {}) {
    const { afterTime, excludeTypes = [] } = options;
    const conditions = [eq(chatMessages.conversationId, conversationId)];

    if (afterTime) {
      const date = afterTime instanceof Date ? afterTime : new Date(afterTime);
      if (!isNaN(date.getTime())) {
        conditions.push(gt(chatMessages.createdAt, date));
      }
    }
    
    const segmentConditions = [];
    if (Array.isArray(excludeTypes) && excludeTypes.length > 0) {
      segmentConditions.push(notInArray(chatMessageSegments.type, excludeTypes));
    }

    const rows = await db
      .select({
        id: chatMessageSegments.id,
        messageId: chatMessageSegments.messageId,
        type: chatMessageSegments.type,
        content: chatMessageSegments.content,
        createdAt: chatMessageSegments.createdAt,
        hidden: chatMessageSegments.hidden,
        role: chatMessages.role,
      })
      .from(chatMessageSegments)
      .innerJoin(chatMessages, eq(chatMessages.id, chatMessageSegments.messageId))
      .where(and(...conditions, ...segmentConditions))
      .orderBy(desc(chatMessageSegments.createdAt))
      .limit(limit);

    return rows.map(mapResponse);
  },
};

export default ChatMessageRepository;
