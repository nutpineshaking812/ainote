import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { mapResponse } from '../db/utils.js';
import { gatewaySessions } from '../db/schema/index.js';
import { createBaseRepository } from './base.repository.js';

const baseRepo = createBaseRepository(gatewaySessions);

/**
 * Unified Session Repository
 * Resolves platform-specific identifiers to global sessionIds.
 */
export const GatewaySessionRepository = {
  ...baseRepo,

  /**
   * Find a session by its global unique sessionId
   */
  async findBySessionId(sessionId) {
    const [result] = await db
      .select()
      .from(gatewaySessions)
      .where(eq(gatewaySessions.sessionId, sessionId));
    return mapResponse(result);
  },

  /**
   * 一次性获取会话及其绑定的渠道配置
   */
  async findWithChannel(sessionId) {
    const { gatewayChannels } = await import('../db/schema/index.js');
    const [result] = await db
      .select({
        session: gatewaySessions,
        channel: gatewayChannels,
      })
      .from(gatewaySessions)
      .innerJoin(gatewayChannels, eq(gatewaySessions.channelId, gatewayChannels.id))
      .where(eq(gatewaySessions.sessionId, sessionId));

    if (!result) return null;

    return {
      ...mapResponse(result.session),
      channel: mapResponse(result.channel),
    };
  },

  /**
   * Find (or later use to upsert) a session by platform-specific metadata
   * Useful for Inbound identification.
   */
  async findByPlatformIdentity(platform, channelId, platformKey, platformValue) {
    // This is a complex query because of jsonb metadata
    // For now, simpler exact match if we can define a standard schema
    const results = await db
      .select()
      .from(gatewaySessions)
      .where(
        and(
          eq(gatewaySessions.platform, platform),
          eq(gatewaySessions.channelId, channelId),
          // Note: Full JSONB filtering might be added here if needed
        ),
      );

    // Filter in JS for platformMetadata exact match if necessary,
    // or use sql`` for jsonb_extract_path_text
    return results.map(mapResponse).find((s) => s.platformMetadata[platformKey] === platformValue);
  },
};

export default GatewaySessionRepository;
