import { db } from '../db/index.js';
import { aiMemories } from '../db/schema/index.js';
import { eq, and, sql, desc, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

class AIMemoryRepository {
  async findById(id) {
    const [result] = await db.select().from(aiMemories).where(eq(aiMemories.id, id));
    return result || null;
  }

  async findByApp(appId, sessionId = null) {
    const filters = [eq(aiMemories.appId, appId.toString())];
    if (sessionId) {
      filters.push(eq(aiMemories.sessionId, sessionId));
    }
    
    return db
      .select()
      .from(aiMemories)
      .where(and(...filters))
      .orderBy(desc(aiMemories.updatedAt));
  }

  async create(data) {
    const id = data.id || uuidv4();
    const [result] = await db
      .insert(aiMemories)
      .values({
        id,
        appId: data.appId?.toString(),
        userId: data.userId?.toString(),
        sessionId: data.sessionId,
        sessionName: data.sessionName,
        title: data.title,
        blocks: data.blocks || [],
        content: data.content,
        category: data.category || 'FACT',
        entities: data.entities || [],
        importance: data.importance || 5,
        recallCount: data.recallCount || 0,
        lastRecalledAt: data.lastRecalledAt,
        sourceExecutionId: data.sourceExecutionId,
        version: data.version || 1,
      })
      .returning();
    return result;
  }

  async update(id, data) {
    const [result] = await db
      .update(aiMemories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aiMemories.id, id))
      .returning();
    return result;
  }

  async delete(id) {
    return db.delete(aiMemories).where(eq(aiMemories.id, id));
  }

  async incrementRecall(id) {
    return db
      .update(aiMemories)
      .set({
        recallCount: sql`${aiMemories.recallCount} + 1`,
        lastRecalledAt: new Date(),
      })
      .where(eq(aiMemories.id, id));
  }

  /**
   * 按 appId + sessionId 查找 Agent 长期记忆（category = 'AGENT_MEMORY'）
   */
  async findAgentMemory(appId, sessionId) {
    if (!appId || !sessionId) return null;
    const [result] = await db
      .select()
      .from(aiMemories)
      .where(
        and(
          eq(aiMemories.appId, appId.toString()),
          eq(aiMemories.sessionId, sessionId.toString()),
          eq(aiMemories.category, 'AGENT_MEMORY'),
        ),
      );
    return result || null;
  }

  /**
   * 插入或更新 Agent 长期记忆（先查后 upsert）
   */
  async upsertAgentMemory({ appId, userId, sessionId, sessionName, title, blocks, content }) {
    const existing = await this.findAgentMemory(appId, sessionId);

    if (existing) {
      return await this.update(existing.id, {
        blocks: blocks || [],
        content: content || null,
        sessionName: sessionName || existing.sessionName,
      });
    }

    return await this.create({
      appId,
      userId,
      sessionId,
      sessionName,
      title: title || '智能体长期记忆',
      blocks: blocks || [],
      content: content || null,
      category: 'AGENT_MEMORY',
    });
  }

  /**
   * 列出某 app 下所有 Agent 长期记忆
   */
  async listAgentMemories(appId) {
    return db
      .select()
      .from(aiMemories)
      .where(
        and(
          eq(aiMemories.appId, appId.toString()),
          eq(aiMemories.category, 'AGENT_MEMORY'),
        ),
      )
      .orderBy(desc(aiMemories.updatedAt));
  }
}

export default new AIMemoryRepository();
