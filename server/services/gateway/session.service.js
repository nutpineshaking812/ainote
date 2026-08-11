import GatewaySessionRepository from '../../repositories/gatewaySession.repository.js';
import { logger } from '../../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * SessionService
 * Orchestrates cross-platform identity resolution.
 */
class SessionService {
  /**
   * Resolve a platform-specific event into a UnifiedSession.
   * Creates one if it doesn't exist.
   */
  /**
   * Resolve a platform-specific event into a UnifiedSession.
   * Creates one if it doesn't exist.
   */
  async resolve(platform, channelId, platformData) {
    const { userId, conversationId } = this._extractIdentities(platform, platformData);

    // Look up existing session
    let session = await GatewaySessionRepository.findByPlatformIdentity(
      platform,
      channelId,
      'conversationId',
      conversationId,
    );

    const mergedMetadata = {
      userId,
      conversationId,
      ...platformData,
    };

    if (!session) {
      logger.info({ platform, conversationId }, 'Creating new unified session');
      session = await GatewaySessionRepository.create({
        sessionId: `${platform}_${uuidv4().substring(0, 12)}`,
        platform,
        channelId,
        platformMetadata: mergedMetadata,
        lastActiveAt: new Date(),
      });
    } else {
      // Always update platform metadata to capture latest webhooks, card context, etc.
      session = await GatewaySessionRepository.update(session.id, {
        platformMetadata: { ...session.platformMetadata, ...mergedMetadata },
        lastActiveAt: new Date(),
      });
    }

    return session;
  }

  async getById(sessionId) {
    return GatewaySessionRepository.findBySessionId(sessionId);
  }

  /**
   * Internal helper to normalize platform keys
   */
  _extractIdentities(platform, metadata) {
    switch (platform) {
      case 'dingtalk':
        return {
          userId: metadata.senderId,
          conversationId: metadata.conversationId,
        };
      case 'web':
        return {
          userId: metadata.userId || 'anonymous',
          conversationId: metadata.sessionId || metadata.conversationId, // Web uses its own sessionId as conversationId
        };
      default:
        return {
          userId: metadata.userId || 'system',
          conversationId: metadata.conversationId || 'default',
        };
    }
  }
}

export default new SessionService();
