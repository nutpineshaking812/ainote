import { files } from '../db/schema/index.js';
import { createBaseRepository } from './base.repository.js';
import { db } from '../db/index.js';
import { eq, sql } from 'drizzle-orm';
import { mapResponse } from '../db/utils.js';

/**
 * File Repository
 * Uses Drizzle for PostgreSQL operations.
 */
const baseRepo = createBaseRepository(files);

const FileRepository = {
  ...baseRepo,

  /**
   * Find a file by its key and provider
   */
  async findByKey(key, provider) {
    const [result] = await db
      .select()
      .from(files)
      .where(
        sql`${files.key} = ${key} AND ${files.provider} = ${provider}`
      )
      .limit(1);
    return mapResponse(result);
  }
};

export default FileRepository;
