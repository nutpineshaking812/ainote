import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { organizationMembers } from '../db/schema/index.js';
import { createBaseRepository } from './base.repository.js';

const baseRepo = createBaseRepository(organizationMembers);

const OrganizationMemberRepository = {
  ...baseRepo,

  async findByUserId(userId) {
    return await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId));
  },

  async findOne(userId, organizationId) {
    const [result] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.status, 'ACTIVE')
        )
      );
    return result;
  },

  async findByOrganization(organizationId) {
    return await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId));
  },

  async findByDepartmentId(departmentId) {
    return await db
      .select()
      .from(organizationMembers)
      .where(sql`${organizationMembers.departmentIds} @> ${JSON.stringify([departmentId])}::jsonb`);
  },

  async invalidateOrgCache(organizationId) {
    return await db
      .update(organizationMembers)
      .set({
        permCache: null,
        permCacheUpdatedAt: null,
      })
      .where(eq(organizationMembers.organizationId, organizationId));
  },

  async invalidateDeptCache(departmentId, organizationId) {
    return await db
      .update(organizationMembers)
      .set({
        permCache: null,
        permCacheUpdatedAt: null,
      })
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          sql`${organizationMembers.departmentIds} @> ${JSON.stringify([departmentId])}::jsonb`
        )
      );
  },

  async removeRoleFromAllMembers(roleId) {
    return await db
      .update(organizationMembers)
      .set({
        roleIds: sql`${organizationMembers.roleIds} - ${roleId}`,
        permCache: null,
        permCacheUpdatedAt: null,
      })
      .where(sql`${organizationMembers.roleIds} ? ${roleId}`);
  },
  
  async deleteByUserIdAndOrg(userId, organizationId) {
    return await db
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId)
        )
      );
  }
};

export default OrganizationMemberRepository;
