import { db } from '../db/index.js';
import { apiKeys } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

class ApiKeyRepository {
  async findByApp(appId) {
    return db.select().from(apiKeys).where(eq(apiKeys.appId, appId));
  }

  async findById(id) {
    const [result] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return result || null;
  }

  async create(data) {
    const id = data.id || uuidv4();
    const [result] = await db
      .insert(apiKeys)
      .values({
        id,
        appId: data.appId.toString(),
        name: data.name,
        prefix: data.prefix,
        hash: data.hash,
        createdAt: new Date(),
      })
      .returning();
    return result;
  }

  async delete(id) {
    return db.delete(apiKeys).where(eq(apiKeys.id, id));
  }

  async updateLastUsed(id) {
    return db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
  }
}

export default new ApiKeyRepository();
