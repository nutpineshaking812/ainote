import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { mapResponse } from '../db/utils.js';
import { gatewayChannels } from '../db/schema/index.js';
import { createBaseRepository } from './base.repository.js';

const baseRepo = createBaseRepository(gatewayChannels);

/**
 * Channel Repository
 * Manages physical provider instances (DingTalk, Web, SMTP, etc.)
 */
export const GatewayChannelRepository = {
  ...baseRepo,

  /**
   * Find all active gatewayChannels for an organization
   */
  async findActiveByOrg(organizationId) {
    const results = await db
      .select()
      .from(gatewayChannels)
      .where(
        and(
          eq(gatewayChannels.organizationId, organizationId),
          eq(gatewayChannels.status, 'ACTIVE'),
        ),
      );
    return results.map(mapResponse);
  },

  /**
   * Find by provider type
   */
  async findByProvider(providerId, organizationId) {
    const results = await db
      .select()
      .from(gatewayChannels)
      .where(
        and(
          eq(gatewayChannels.providerId, providerId),
          eq(gatewayChannels.organizationId, organizationId),
        ),
      );
    return results.map(mapResponse);
  },

  /**
   * Find all active gatewayChannels across all organizations (for system startup)
   */
  async findAllEnabled() {
    const results = await db
      .select()
      .from(gatewayChannels)
      .where(eq(gatewayChannels.status, 'ACTIVE'));
    return results.map(mapResponse);
  },
};

export default GatewayChannelRepository;
