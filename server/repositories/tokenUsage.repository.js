import { db } from '../db/index.js';
import { tokenUsage } from '../db/schema/index.js';
import { eq, and, sql, desc, gte, lte, lt, gt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

class TokenUsageRepository {
  async create(data) {
    const id = data.id || uuidv4();
    const [result] = await db
      .insert(tokenUsage)
      .values({
        id,
        userId: data.userId.toString(),
        organizationId: data.organizationId?.toString(),
        appId: data.appId?.toString(),
        model: data.model,
        promptTokens: data.promptTokens ?? 0,
        completionTokens: data.completionTokens ?? 0,
        totalTokens: data.totalTokens ?? 0,
        runName: data.runName,
        taskId: data.taskId,
        timestamp: data.timestamp || new Date(),
      })
      .returning();
    return result;
  }

  async findWithFilters(filters = {}, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const whereClauses = [];
    if (filters.userId) whereClauses.push(eq(tokenUsage.userId, filters.userId.toString()));
    if (filters.organizationId) whereClauses.push(eq(tokenUsage.organizationId, filters.organizationId.toString()));
    if (filters.appId) whereClauses.push(eq(tokenUsage.appId, filters.appId.toString()));
    if (filters.model) whereClauses.push(eq(tokenUsage.model, filters.model));
    
    if (filters.startTime) whereClauses.push(gte(tokenUsage.timestamp, new Date(filters.startTime)));
    if (filters.endTime) whereClauses.push(lte(tokenUsage.timestamp, new Date(filters.endTime)));

    const queryBuilder = db
      .select()
      .from(tokenUsage)
      .where(and(...whereClauses))
      .orderBy(desc(tokenUsage.timestamp))
      .limit(limit)
      .offset(offset);

    const countBuilder = db
      .select({ count: sql`count(*)` })
      .from(tokenUsage)
      .where(and(...whereClauses));

    const [records, [countResult]] = await Promise.all([
      queryBuilder,
      countBuilder
    ]);

    return {
      records,
      total: Number(countResult?.count || 0)
    };
  }

  async findByUser(userId, limit = 100) {
    return db
      .select()
      .from(tokenUsage)
      .where(eq(tokenUsage.userId, userId.toString()))
      .orderBy(desc(tokenUsage.timestamp))
      .limit(limit);
  }

  async findByOrganization(organizationId, limit = 100) {
    return db
      .select()
      .from(tokenUsage)
      .where(eq(tokenUsage.organizationId, organizationId.toString()))
      .orderBy(desc(tokenUsage.timestamp))
      .limit(limit);
  }

  async getStats(organizationId, startDate, endDate) {
    const filters = [eq(tokenUsage.organizationId, organizationId.toString())];
    if (startDate) filters.push(gte(tokenUsage.timestamp, startDate));
    if (endDate) filters.push(lte(tokenUsage.timestamp, endDate));

    const [result] = await db
      .select({
        totalTokens: sql`sum(${tokenUsage.totalTokens})`,
        promptTokens: sql`sum(${tokenUsage.promptTokens})`,
        completionTokens: sql`sum(${tokenUsage.completionTokens})`,
        count: sql`count(*)`,
      })
      .from(tokenUsage)
      .where(and(...filters));
    
    return {
      totalTokens: Number(result?.totalTokens || 0),
      promptTokens: Number(result?.promptTokens || 0),
      completionTokens: Number(result?.completionTokens || 0),
      count: Number(result?.count || 0),
    };
  }
}

export default new TokenUsageRepository();
