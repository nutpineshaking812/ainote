import { createBaseRepository } from './base.repository.js';
import { forms } from '../db/schema/index.js';
import { db } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { mapResponse } from '../db/utils.js';

const baseRepo = createBaseRepository(forms);

export const formRepository = {
  ...baseRepo,

  /**
   * Find all forms for a specific application
   */
  async findByAppId(appId) {
    const results = await db
      .select()
      .from(forms)
      .where(eq(forms.appId, appId))
      .orderBy(forms.createdAt);
    return results.map(mapResponse);
  },

  /**
   * Find a specific form within an application
   */
  async findOneByAppAndId(appId, id) {
    const [result] = await db
      .select()
      .from(forms)
      .where(and(eq(forms.appId, appId), eq(forms.id, id)));
    return mapResponse(result);
  },

  /**
   * Find forms without large fields (fields, actions)
   */
  async findSummaryByAppId(appId, extraConditions = null) {
    let query = db
      .select({
        id: forms.id,
        name: forms.name,
        description: forms.description,
        appId: forms.appId,
        owner: forms.owner,
        showIndex: forms.showIndex,
        createdAt: forms.createdAt,
        updatedAt: forms.updatedAt,
      })
      .from(forms);

    const conditions = [eq(forms.appId, appId)];
    if (extraConditions) {
      // extraConditions should be a function (table, drizzle) => expression
      const drizzle = await import('drizzle-orm');
      conditions.push(extraConditions(forms, drizzle));
    }

    const results = await query.where(and(...conditions)).orderBy(forms.createdAt);
    return results.map(mapResponse);
  },
};

