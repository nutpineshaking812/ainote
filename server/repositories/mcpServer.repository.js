import { db } from '../db/index.js';
import { mcpServers } from '../db/schema/index.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

class McpServerRepository {
  async findById(id) {
    const [result] = await db.select().from(mcpServers).where(eq(mcpServers.id, id));
    return result || null;
  }

  async findByName(name) {
    const [result] = await db.select().from(mcpServers).where(eq(mcpServers.name, name));
    return result || null;
  }

  async findAll(organizationId) {
    const filters = [];
    if (organizationId) {
      filters.push(eq(mcpServers.organizationId, organizationId.toString()));
    }
    
    return db
      .select()
      .from(mcpServers)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(mcpServers.createdAt));
  }

  async findActive(organizationId) {
    const filters = [eq(mcpServers.status, 'ACTIVE')];
    if (organizationId) {
      filters.push(eq(mcpServers.organizationId, organizationId.toString()));
    }
    
    return db
      .select()
      .from(mcpServers)
      .where(and(...filters))
      .orderBy(desc(mcpServers.createdAt));
  }

  async create(data) {
    const id = data.id || uuidv4();
    const [result] = await db
      .insert(mcpServers)
      .values({
        id,
        name: data.name,
        label: data.label,
        description: data.description,
        type: data.type || 'stdio',
        stdioConfig: data.stdioConfig || {},
        httpConfig: data.httpConfig || {},
        tools: data.tools || [],
        resources: data.resources || [],
        prompts: data.prompts || [],
        runtime: data.runtime || {},
        status: data.status || 'INACTIVE',
        organizationId: data.organizationId?.toString(),
        createdBy: data.createdBy?.toString(),
      })
      .returning();
    return result;
  }

  async update(id, data) {
    const [result] = await db
      .update(mcpServers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(mcpServers.id, id))
      .returning();
    return result;
  }

  async delete(id) {
    return db.delete(mcpServers).where(eq(mcpServers.id, id));
  }
}

export default new McpServerRepository();
