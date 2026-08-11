import { db } from '../db/index.js';
import { invitations } from '../db/schema/index.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

class InvitationRepository {
  async findById(id, tx = null) {
    const executor = tx || db;
    const [result] = await executor.select().from(invitations).where(eq(invitations.id, id));
    return result || null;
  }

  async findByCode(code, tx = null) {
    const executor = tx || db;
    const [result] = await executor
      .select()
      .from(invitations)
      .where(and(eq(invitations.code, code), eq(invitations.status, 'ACTIVE')));
    return result || null;
  }

  async findByInviter(inviterId, type = 'PLATFORM', tx = null) {
    const executor = tx || db;
    return executor
      .select()
      .from(invitations)
      .where(and(eq(invitations.inviter, inviterId.toString()), eq(invitations.type, type)))
      .orderBy(desc(invitations.createdAt));
  }

  async findByOrganization(organizationId, limit = 20, offset = 0, tx = null) {
    const executor = tx || db;
    const query = and(
      eq(invitations.targetOrganizationId, organizationId.toString()),
      eq(invitations.type, 'ORG_JOIN')
    );

    const [records, [countResult]] = await Promise.all([
      executor.select().from(invitations).where(query).orderBy(desc(invitations.createdAt)).limit(limit).offset(offset),
      executor.select({ count: sql`count(*)` }).from(invitations).where(query)
    ]);

    return {
      records,
      total: Number(countResult?.count || 0)
    };
  }

  async create(data, tx = null) {
    const executor = tx || db;
    const id = data.id || uuidv4();
    const [result] = await executor
      .insert(invitations)
      .values({
        id,
        code: data.code,
        inviter: data.inviter.toString(),
        targetOrganizationId: data.targetOrganizationId?.toString(),
        maxUses: data.maxUses ?? 1,
        type: data.type || 'PLATFORM',
        status: data.status || 'ACTIVE',
        expiresAt: data.expiresAt,
      })
      .onConflictDoUpdate({
        target: [invitations.code],
        set: {
          inviter: data.inviter.toString(),
          targetOrganizationId: data.targetOrganizationId?.toString(),
          maxUses: data.maxUses ?? 1,
          type: data.type || 'PLATFORM',
          status: data.status || 'ACTIVE',
          expiresAt: data.expiresAt,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async update(id, data, tx = null) {
    const executor = tx || db;
    const [result] = await executor
      .update(invitations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(invitations.id, id))
      .returning();
    return result;
  }

  async incrementUses(id, userId, tx = null) {
    const executor = tx || db;
    const [result] = await executor
      .update(invitations)
      .set({
        uses: sql`${invitations.uses} + 1`,
        usedBy: sql`array_append(${invitations.usedBy}, ${userId.toString()})`,
        updatedAt: new Date(),
      })
      .where(eq(invitations.id, id))
      .returning();
    return result;
  }

  async updateStatus(id, status, tx = null) {
    const executor = tx || db;
    const [result] = await executor
      .update(invitations)
      .set({ status, updatedAt: new Date() })
      .where(eq(invitations.id, id))
      .returning();
    return result;
  }

  async delete(id, tx = null) {
    const executor = tx || db;
    return executor.delete(invitations).where(eq(invitations.id, id));
  }
}

export default new InvitationRepository();
