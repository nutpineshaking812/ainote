import { db } from '../db/index.js';
import { quotas } from '../db/schema/index.js';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

class QuotaRepository {
  async findById(id, tx = null) {
    const executor = tx || db;
    const [result] = await executor.select().from(quotas).where(eq(quotas.id, id));
    return result || null;
  }

  async findByTargetIds(targetType, targetIds, tx = null) {
    const executor = tx || db;
    if (!targetIds || targetIds.length === 0) return [];
    return executor
      .select()
      .from(quotas)
      .where(
        and(
          eq(quotas.targetType, targetType),
          inArray(quotas.targetId, targetIds.map(id => id.toString()))
        )
      );
  }

  async findOne(targetType, targetId, tx = null) {
    const executor = tx || db;
    const [result] = await executor
      .select()
      .from(quotas)
      .where(
        and(
          eq(quotas.targetType, targetType),
          eq(quotas.targetId, targetId.toString())
        )
      );
    return result || null;
  }

  async create(data, tx = null) {
    const executor = tx || db;
    const id = data.id || uuidv4();
    const [result] = await executor
      .insert(quotas)
      .values({
        id,
        targetType: data.targetType,
        targetId: data.targetId.toString(),
        tokenBalance: data.tokenBalance ?? 0,
        totalTokenUsage: data.totalTokenUsage ?? 0,
        usageLimit: data.usageLimit ?? -1,
        invitationSlots: data.invitationSlots ?? 0,
        memberLimit: data.memberLimit ?? 50,
        lastResetDate: data.lastResetDate,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date(),
      })
      .returning();
    return result;
  }

  async update(targetType, targetId, data, tx = null) {
    const executor = tx || db;
    const [result] = await executor
      .update(quotas)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(quotas.targetType, targetType),
          eq(quotas.targetId, targetId.toString())
        )
      )
      .returning();
    return result;
  }

  async upsert(targetType, targetId, data, tx = null) {
    const executor = tx || db;
    const id = uuidv4();
    const [result] = await executor
      .insert(quotas)
      .values({
        id,
        targetType,
        targetId: targetId.toString(),
        ...data,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [quotas.targetType, quotas.targetId],
        set: {
          ...data,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async updateById(id, data, tx = null) {
    const executor = tx || db;
    const [result] = await executor
      .update(quotas)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(quotas.id, id))
      .returning();
    return result;
  }

  async delete(targetType, targetId, tx = null) {
    const executor = tx || db;
    await executor
      .delete(quotas)
      .where(
        and(
          eq(quotas.targetType, targetType),
          eq(quotas.targetId, targetId.toString())
        )
      );
    return true;
  }

  /**
   * 原子更新余额和使用量 (针对 ORG)
   */
  async incrementUsage(targetId, amount, tx = null) {
    const executor = tx || db;
    const [result] = await executor
      .update(quotas)
      .set({
        tokenBalance: sql`${quotas.tokenBalance} - ${amount}`,
        totalTokenUsage: sql`${quotas.totalTokenUsage} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(quotas.targetType, 'ORG'),
          eq(quotas.targetId, targetId.toString())
        )
      )
      .returning();
    return result;
  }

  /**
   * 原子更新总使用量 (针对 USER)
   */
  async incrementTotalUsage(targetId, amount, tx = null) {
    const executor = tx || db;
    const [result] = await executor
      .update(quotas)
      .set({
        totalTokenUsage: sql`${quotas.totalTokenUsage} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(quotas.targetType, 'USER'),
          eq(quotas.targetId, targetId.toString())
        )
      )
      .returning();
    return result;
  }

  /**
   * 增加邀请名额
   */
  async addInvitationSlots(targetType, targetId, amount, tx = null) {
    const executor = tx || db;
    const [result] = await executor
      .update(quotas)
      .set({
        invitationSlots: sql`${quotas.invitationSlots} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(quotas.targetType, targetType),
          eq(quotas.targetId, targetId.toString())
        )
      )
      .returning();
    return result;
  }
}

export default new QuotaRepository();
