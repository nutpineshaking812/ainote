import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { publishSettings } from '../db/schema/index.js';
import { createBaseRepository } from './base.repository.js';
import { mapResponse } from '../db/utils.js';

const baseRepo = createBaseRepository(publishSettings);

/**
 * Publish Setting Repository
 * Manages form publication settings (public links, API tokens, etc.) in PostgreSQL.
 */
const PublishSettingRepository = {
  ...baseRepo,

  /**
   * Find by formId
   */
  async findByFormId(formId) {
    const [result] = await db
      .select()
      .from(publishSettings)
      .where(eq(publishSettings.formId, formId.toString()))
      .limit(1);
    return mapResponse(result);
  },

  /**
   * Find by API token
   * Note: This searches within the externalApi JSONB array
   */
  async findByApiToken(token) {
    // Search for a token entry within the tokens array of external_api JSONB
    const results = await db
      .select()
      .from(publishSettings)
      .where(sql`${publishSettings.externalApi}->'tokens' @> ${JSON.stringify([{ token }])}`);
      
    return results.map(mapResponse);
  },

  /**
   * Delete by formId
   */
  async deleteByFormId(formId) {
    const results = await db
      .delete(publishSettings)
      .where(eq(publishSettings.formId, formId.toString()))
      .returning();
    return results.map(mapResponse);
  }
};

export default PublishSettingRepository;
