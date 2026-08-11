import { db } from '../db/index.js';
import { permissionAssignments } from '../db/schema/index.js';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

class PermissionAssignmentRepository {
  async findById(id) {
    const [result] = await db.select().from(permissionAssignments).where(eq(permissionAssignments.id, id));
    return result || null;
  }

  async findByOrganization(organizationId, principalId = null) {
    const filters = [eq(permissionAssignments.organizationId, organizationId.toString())];
    if (principalId) filters.push(eq(permissionAssignments.principalId, principalId.toString()));
    return db.select().from(permissionAssignments).where(and(...filters));
  }

  async findAssignments(query = {}) {
    const filters = [];
    if (query.organizationId) filters.push(eq(permissionAssignments.organizationId, query.organizationId.toString()));
    if (query.principalId) {
       if (Array.isArray(query.principalId)) {
         filters.push(inArray(permissionAssignments.principalId, query.principalId.map(id => id.toString())));
       } else {
         filters.push(eq(permissionAssignments.principalId, query.principalId.toString()));
       }
    }
    if (query.principalType) {
       if (Array.isArray(query.principalType)) {
         filters.push(inArray(permissionAssignments.principalType, query.principalType));
       } else {
         filters.push(eq(permissionAssignments.principalType, query.principalType));
       }
    }
    if (query.scope) filters.push(eq(permissionAssignments.scope, query.scope));
    if (query.resourceId) filters.push(eq(permissionAssignments.resourceId, query.resourceId.toString()));
    if (query.roleId) filters.push(eq(permissionAssignments.roleId, query.roleId.toString()));

    return db.select().from(permissionAssignments).where(and(...filters));
  }

  async create(data) {
    const id = data.id || uuidv4();
    const [result] = await db
      .insert(permissionAssignments)
      .values({
        id,
        organizationId: data.organizationId.toString(),
        principalType: data.principalType,
        principalId: data.principalId.toString(),
        roleId: data.roleId.toString(),
        roleKey: data.roleKey,
        scope: data.scope,
        resourceId: data.resourceId.toString(),
        createdBy: data.createdBy?.toString(),
      })
      .returning();
    return result;
  }

  async delete(id) {
    return db.delete(permissionAssignments).where(eq(permissionAssignments.id, id));
  }

  async deleteMany(query = {}) {
    const filters = [];
    if (query.organizationId) filters.push(eq(permissionAssignments.organizationId, query.organizationId.toString()));
    if (query.resourceId) filters.push(eq(permissionAssignments.resourceId, query.resourceId.toString()));
    if (query.principalId) filters.push(eq(permissionAssignments.principalId, query.principalId.toString()));
    if (query.scope) {
      if (Array.isArray(query.scope)) {
        filters.push(inArray(permissionAssignments.scope, query.scope));
      } else {
        filters.push(eq(permissionAssignments.scope, query.scope));
      }
    }

    if (filters.length === 0) return; // Prevent accidental wipe
    return db.delete(permissionAssignments).where(and(...filters));
  }

  async findOne(query = {}) {
    const results = await this.findAssignments(query);
    return results[0] || null;
  }
}

export default new PermissionAssignmentRepository();
