import { localDb } from '../local-db/LocalDatabaseManager';
import api from '../../api';
import {
  ResourceItem,
  SyncResponse,
  ResourceUpdateCallback,
  FetchMode,
  ResourceCacheOptions,
} from './types';
import {
  MSG_RESOURCES_GET_ALL,
  MSG_RESOURCES_UPSERT_BATCH,
  MSG_RESOURCES_CLEAR_APP,
  MSG_RESOURCES_GET_SYNC_TIME,
  MSG_RESOURCES_UPDATE,
  MSG_RESOURCES_DELETE,
  MSG_RESOURCES_DELETE_BATCH,
} from '../local-db/messageTypes';

/**
 * Resource Cache Manager (Singleton)
 *
 * Manages resource caching with SQLite storage and network synchronization.
 * Uses LocalDatabaseManager for unified database access.
 */
export class ResourceCache {
  private static instance: ResourceCache;
  private subscribers: Map<string, Set<ResourceUpdateCallback>> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ResourceCache {
    if (!ResourceCache.instance) {
      ResourceCache.instance = new ResourceCache();
    }
    return ResourceCache.instance;
  }

  /**
   * Initialize the cache system (delegates to LocalDatabaseManager)
   */
  public async initialize(): Promise<void> {
    await localDb.initialize();
  }

  /**
   * Send message to worker via LocalDatabaseManager
   */
  private async sendMessage(type: string, payload: any = {}): Promise<any> {
    return localDb.sendMessage(type, payload);
  }

  /**
   * Get resources from local cache
   *
   * @param appId Application ID
   * @returns Cached resources or empty array
   */
  public async getFromCache(appId: string): Promise<ResourceItem[]> {
    try {
      const data = await this.sendMessage(MSG_RESOURCES_GET_ALL, { appId });
      return data || [];
    } catch (error) {
      console.error('[ResourceCache] Failed to get from cache:', error);
      return [];
    }
  }

  /**
   * Sync resources from network
   *
   * @param appId Application ID
   * @param parentId Optional parent ID to sync only children of this parent
   * @returns Synced resources
   */
  public async syncFromNetwork(appId: string, parentId?: string): Promise<ResourceItem[]> {
    try {
      // Get last sync timestamp
      const lastSyncAt = await this.sendMessage(MSG_RESOURCES_GET_SYNC_TIME, { appId });

      // Build sync URL with optional filters
      let url = `/apps/${appId}/resources/sync`;
      const params = new URLSearchParams();

      console.log('parentId', parentId, lastSyncAt);
      if (lastSyncAt) {
        params.append('updatedAfter', lastSyncAt);
      }
      if (parentId !== undefined) {
        params.append('parentId', parentId || 'null');
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      // Fetch from server
      const response: SyncResponse = await api.get(url);

      if (response.items && response.items.length > 0) {
        // Update cache with new/changed items (includes sync timestamp)
        await this.sendMessage(MSG_RESOURCES_UPSERT_BATCH, {
          appId,
          items: response.items,
          syncTimestamp: response.timestamp,
        });

        console.log(`[ResourceCache] Synced ${response.items.length} resources for app ${appId}`);
      }

      // Handle deleted resources
      if (response.deletedIds && response.deletedIds.length > 0) {
        await this.sendMessage(MSG_RESOURCES_DELETE_BATCH, {
          appId,
          ids: response.deletedIds,
        });

        console.log(
          `[ResourceCache] Removed ${response.deletedIds.length} deleted resources from cache`,
        );
      }

      // Get updated cache
      const allResources = await this.getFromCache(appId);

      // Notify subscribers
      this.notifySubscribers(appId, allResources);

      return allResources;
    } catch (error) {
      console.error('[ResourceCache] Sync failed:', error);
      throw error;
    }
  }

  /**
   * Get resources with specified fetch mode
   *
   * @param appId Application ID
   * @param options Fetch options
   * @returns Resources based on fetch mode
   */
  public async getResources(
    appId: string,
    options: ResourceCacheOptions = {},
  ): Promise<ResourceItem[]> {
    const { mode = 'cache-first' } = options;

    switch (mode) {
      case 'only-cache':
        // Return cache immediately, no network request
        return this.getFromCache(appId);

      case 'only-network':
        // Fetch from network, update cache, return
        return this.syncFromNetwork(appId);

      case 'cache-first':
      default:
        // Return cache immediately, sync in background
        const cachedData = await this.getFromCache(appId);

        // Trigger background sync (don't await)
        this.syncFromNetwork(appId).catch((error) => {
          console.error('[ResourceCache] Background sync failed:', error);
        });

        return cachedData;
    }
  }

  /**
   * Update resource in cache
   * @param appId Application ID
   * @param resourceId Resource ID
   * @param updates Partial updates to apply
   */
  public async updateResource(
    appId: string,
    resourceId: string,
    updates: Partial<ResourceItem>,
  ): Promise<void> {
    await this.sendMessage(MSG_RESOURCES_UPDATE, { appId, resourceId, updates });

    // Get updated cache and notify subscribers
    const allResources = await this.getFromCache(appId);
    this.notifySubscribers(appId, allResources);
    console.log(`[ResourceCache] Updated resource ${resourceId} in app ${appId}`);
  }

  /**
   * Delete resource from cache
   * @param appId Application ID
   * @param resourceId Resource ID
   */
  public async deleteResource(appId: string, resourceId: string): Promise<void> {
    await this.sendMessage(MSG_RESOURCES_DELETE, { appId, resourceId });

    // Get updated cache and notify subscribers
    const allResources = await this.getFromCache(appId);
    this.notifySubscribers(appId, allResources);
    console.log(`[ResourceCache] Deleted resource ${resourceId} from app ${appId}`);
  }

  /**
   * Add child resource to cache
   * @param appId Application ID
   * @param resource Resource to add
   */
  public async addChildResource(appId: string, resource: ResourceItem): Promise<void> {
    // Use upsertBatch to add single resource
    await this.sendMessage(MSG_RESOURCES_UPSERT_BATCH, {
      appId,
      items: [resource],
      syncTimestamp: new Date().toISOString(),
    });

    // Get updated cache and notify subscribers
    const allResources = await this.getFromCache(appId);
    this.notifySubscribers(appId, allResources);
    console.log(`[ResourceCache] Added resource ${resource.id} to app ${appId}`);
  }

  /**
   * Subscribe to resource updates for an app
   *
   * @param appId Application ID
   * @param callback Update callback
   * @returns Unsubscribe function
   */
  public subscribe(appId: string, callback: ResourceUpdateCallback): () => void {
    if (!this.subscribers.has(appId)) {
      this.subscribers.set(appId, new Set());
    }

    this.subscribers.get(appId)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.get(appId)?.delete(callback);
      if (this.subscribers.get(appId)?.size === 0) {
        this.subscribers.delete(appId);
      }
    };
  }

  /**
   * Notify all subscribers for an app
   */
  private notifySubscribers(appId: string, resources: ResourceItem[]): void {
    const callbacks = this.subscribers.get(appId);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(resources);
        } catch (error) {
          console.error('[ResourceCache] Subscriber callback error:', error);
        }
      });
    }
  }

  /**
   * Clear cache for an app
   *
   * @param appId Application ID
   */
  public async clearApp(appId: string): Promise<void> {
    await this.sendMessage(MSG_RESOURCES_CLEAR_APP, { appId });
    this.notifySubscribers(appId, []);
    console.log(`[ResourceCache] Cleared cache for app ${appId}`);
  }
}

// Export singleton instance
export const resourceCache = ResourceCache.getInstance();
