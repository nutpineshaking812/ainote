import { UserPropertyRepository } from '../repositories/userProperty.repository.js';
import { logger } from '../config/logger.js';

/**
 * Service to manage User Properties (Persistence agnostic logic)
 */
/**
 * Service to manage User Properties (Persistence agnostic logic)
 */
const UserPropertyService = {
  /**
   * Get a property by user ID and key
   */
  async getProperty(userId, key, defaultValue = null, ttl = -1) {
    try {
      const record = await UserPropertyRepository.findOne(userId, key);
      if (!record || record.value === undefined) {
        return defaultValue;
      }

      // Check if property has expired (using physical expiresAt column)
      if (record.expiresAt) {
        const expiresAt = new Date(record.expiresAt);
        // Explicitly compare absolute millisecond timestamps to ensure 100% timezone independence
        if (Date.now() > expiresAt.getTime()) {
          logger.info({ userId, key, expiresAt }, '[UserPropertyService] Property has expired. Deleting...');
          // Await deletion to guarantee complete execution inside Temporal Activity execution contexts,
          // avoiding floating un-awaited microtask promises that could be terminated by the runner.
          try {
            await UserPropertyRepository.delete(userId, key);
          } catch (err) {
            logger.error({ err, userId, key }, '[UserPropertyService] Failed to delete expired property');
          }
          return defaultValue;
        }
      }

      // Sliding Expiration / Renew lease: if ttl is provided, extend expiration time
      if (ttl !== null && ttl !== undefined && !isNaN(Number(ttl)) && Number(ttl) > 0) {
        const newExpiresAt = new Date(Date.now() + Number(ttl) * 1000);
        logger.info({ userId, key, ttl }, '[UserPropertyService] Renewing variable expiration lease (Sliding Expiry)');
        try {
          await UserPropertyRepository.upsert(userId, key, record.value, newExpiresAt);
        } catch (err) {
          logger.error({ err, userId, key }, '[UserPropertyService] Failed to renew property lease');
        }
      }

      return record.value;
    } catch (err) {
      logger.error({ err, userId, key }, '[UserPropertyService] Failed to retrieve property');
      return defaultValue;
    }
  },

  /**
   * Set or Update a property with strategy and optional TTL
   * @param {string} strategy - 'overwrite', 'ignore', 'increment'
   * @param {number} ttl - Expiry time in seconds, -1 means no expiration
   */
  async setProperty(userId, key, value, strategy = 'overwrite', ttl = -1) {
    try {
      // 1. Lazy cleanup before writing: if current value exists but is expired, delete it first.
      // This is crucial to ensure that "increment" or "ignore" strategies don't act on dirty/expired values.
      const existing = await UserPropertyRepository.findOne(userId, key);
      if (existing && existing.expiresAt) {
        const expiresAt = new Date(existing.expiresAt);
        // Explicitly compare absolute millisecond timestamps to ensure 100% timezone independence
        if (Date.now() > expiresAt.getTime()) {
          logger.info({ userId, key }, '[UserPropertyService] Existing property is expired before write. Deleting...');
          await UserPropertyRepository.delete(userId, key);
        }
      }

      // 2. Prepare physical expiresAt timestamp if ttl is provided
      let expiresAt = null;
      if (ttl !== null && ttl !== undefined && !isNaN(Number(ttl)) && Number(ttl) > 0) {
        expiresAt = new Date(Date.now() + Number(ttl) * 1000);
      }

      // 3. Perform write based on strategy
      let result;
      switch (strategy) {
        case 'increment':
          result = await UserPropertyRepository.increment(userId, key, value, expiresAt);
          break;

        case 'ignore':
          result = await UserPropertyRepository.insertIgnore(userId, key, value, expiresAt);
          if (result === null) {
            // Already existed and not expired, return current value
            return await this.getProperty(userId, key);
          }
          break;

        case 'overwrite':
        default:
          result = await UserPropertyRepository.upsert(userId, key, value, expiresAt);
          break;
      }
      return result ? result.value : null;
    } catch (err) {
      logger.error({ err, userId, key, strategy, ttl }, '[UserPropertyService] Failed to set property');
      throw err; // Re-throw to inform the caller (e.g. Plugin activity)
    }
  },
};


export const { getProperty, setProperty } = UserPropertyService;
export default UserPropertyService;
