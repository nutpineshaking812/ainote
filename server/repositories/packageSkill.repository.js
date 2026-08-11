import { db } from '../db/index.js';
import { packageSkills } from '../db/schema/index.js';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

class PackageSkillRepository {
  async findById(id) {
    const [result] = await db.select().from(packageSkills).where(eq(packageSkills.id, id));
    return result || null;
  }

  async findByFolderName(folderName) {
    const [result] = await db.select().from(packageSkills).where(eq(packageSkills.folderName, folderName));
    return result || null;
  }

  async findAll(organizationId) {
    const filters = [];
    if (organizationId) {
      filters.push(eq(packageSkills.organizationId, organizationId.toString()));
    }
    
    return db
      .select()
      .from(packageSkills)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(packageSkills.createdAt));
  }

  async findByNames(names, organizationId) {
    if (!names || names.length === 0) return [];
    
    const filters = [inArray(packageSkills.name, names)];
    if (organizationId) {
      filters.push(eq(packageSkills.organizationId, organizationId.toString()));
    }

    return db
      .select()
      .from(packageSkills)
      .where(and(...filters));
  }

  async create(data) {
    const id = data.id || uuidv4();
    const [result] = await db
      .insert(packageSkills)
      .values({
        id,
        folderName: data.folderName,
        name: data.name,
        description: data.description,
        organizationId: data.organizationId?.toString(),
        ownerId: data.ownerId?.toString(),
        parameters: data.parameters || {},
        requires: data.requires || {},
        hideResult: data.hideResult || false,
        status: data.status || 'ACTIVE',
        hasResources: data.hasResources || false,
        lastSyncedAt: data.lastSyncedAt || new Date(),
      })
      .returning();
    return result;
  }

  async upsert(data) {
    const id = uuidv4();
    const [result] = await db
      .insert(packageSkills)
      .values({
        id,
        folderName: data.folderName,
        name: data.name,
        description: data.description,
        organizationId: data.organizationId?.toString(),
        ownerId: data.ownerId?.toString(),
        parameters: data.parameters || {},
        requires: data.requires || {},
        hideResult: data.hideResult || false,
        status: data.status || 'ACTIVE',
        hasResources: data.hasResources || false,
        lastSyncedAt: data.lastSyncedAt || new Date(),
      })
      .onConflictDoUpdate({
        target: [packageSkills.folderName],
        set: {
          name: data.name,
          description: data.description,
          organizationId: data.organizationId?.toString(),
          ownerId: data.ownerId?.toString(),
          parameters: data.parameters || {},
          requires: data.requires || {},
          hideResult: data.hideResult || false,
          status: data.status || 'ACTIVE',
          hasResources: data.hasResources || false,
          lastSyncedAt: data.lastSyncedAt || new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async update(id, data) {
    const [result] = await db
      .update(packageSkills)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(packageSkills.id, id))
      .returning();
    return result;
  }

  async delete(id) {
    return db.delete(packageSkills).where(eq(packageSkills.id, id));
  }

  async deleteByFolderName(folderName) {
    return db.delete(packageSkills).where(eq(packageSkills.folderName, folderName));
  }
}

export default new PackageSkillRepository();
