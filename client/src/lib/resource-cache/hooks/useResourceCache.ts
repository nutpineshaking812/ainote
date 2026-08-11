import { useState, useEffect, useMemo, useCallback } from 'react';
import { resourceCache } from '../ResourceCache';
import { buildResourceTree } from '../utils/treeBuilder';
import { ResourceItem, ResourceTreeNode, ResourceCacheOptions } from '../types';

/**
 * Result type for useResourceCache hook
 */
export interface UseResourceCacheResult {
  /** Flat resource list */
  resources: ResourceItem[];

  /** Tree-structured data */
  treeData: ResourceTreeNode[];

  /** Initial loading state */
  isLoading: boolean;

  /** Background syncing state */
  isSyncing: boolean;

  /** Error if any */
  error: Error | null;

  /** Manual refresh (optionally for specific parentId) */
  refresh: (parentId?: string) => Promise<void>;

  /** Clear cache for this app */
  clearCache: () => Promise<void>;

  /** Get resource by id */
  getResourceById: (resourceId: string) => ResourceItem | undefined;

  /** Get expanded keys for a resource by id */
  getExpandedKeys: (resourceId: string) => string[];

  /** Update resource by id */
  updateResource: (id: string, updates: Partial<ResourceItem>) => Promise<void>;

  /** Delete resource by id */
  deleteResource: (id: string) => Promise<void>;

  /** Add child resource */
  addChildResource: (parentId: string | null, resource: ResourceItem) => Promise<void>;
}

/**
 * React hook for resource caching
 *
 * Provides cache-first access to app resources with tree structure support.
 * Automatically syncs in background and notifies when updates are available.
 *
 * @param appId Application ID (null to disable)
 * @param options Fetch options
 * @returns Resource cache result
 *
 * @example
 * ```tsx
 * const { resources, treeData, isLoading, isSyncing } = useResourceCache(appId);
 *
 * // Use tree data in TreeView component
 * <Tree treeData={treeData} />
 *
 * // Or use flat resources
 * {resources.map(r => <div key={r.id}>{r.meta.name}</div>)}
 * ```
 */
export function useResourceCache(
  appId: string | null,
  options: ResourceCacheOptions = {},
): UseResourceCacheResult {
  // Memoize options to prevent infinite sync loops if parent passes object literals
  const memoOptions = useMemo<ResourceCacheOptions>(
    () => ({
      mode: 'cache-first',
      ...options,
    }),
    [options.mode],
  );

  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Build tree from flat resources
   */
  const treeData = useMemo(() => {
    if (resources.length === 0) return [];
    try {
      return buildResourceTree(resources);
    } catch (err) {
      console.error('[useResourceCache] Failed to build tree:', err);
      return [];
    }
  }, [resources]);

  /**
   * Refresh resources manually (optionally for specific parentId)
   * @param parentId If provided, only refresh children of this parent
   */
  const refresh = useCallback(
    async (parentId?: string) => {
      if (!appId) return;

      try {
        setIsSyncing(true);
        setError(null);

        // Sync from network with optional parentId filter
        await resourceCache.syncFromNetwork(appId, parentId);

        // Get all resources from cache
        const allResources = await resourceCache.getFromCache(appId);
        setResources(allResources);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        console.error('[useResourceCache] Refresh failed:', error);
      } finally {
        setIsSyncing(false);
      }
    },
    [appId],
  );

  /**
   * Clear cache for this app
   */
  const clearCache = useCallback(async () => {
    if (!appId) return;

    try {
      await resourceCache.clearApp(appId);
      setResources([]);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error('[useResourceCache] Clear cache failed:', error);
    }
  }, [appId]);

  /**
   * Get resource by id
   * @param resourceId Resource ID
   * @returns Resource item or undefined if not found
   */
  const getResourceById = useCallback(
    (resourceId: string): ResourceItem | undefined => {
      return resources.find((r) => r.id === resourceId || r.refId === resourceId);
    },
    [resources],
  );

  /**
   * Get expanded keys (parent chain) for a resource
   * @param resourceId Resource ID to find path for
   * @returns Array of keys from root to the resource
   */
  const getExpandedKeys = useCallback(
    (targetId: string): string[] => {
      const keys: string[] = [];
      const resourceMap = new Map(resources.map((r) => [r.id, r]));

      // Find initial resource by id or refId
      let current = resources.find((r) => r.id === targetId || r.refId === targetId);

      while (current) {
        // Use refId in the key to match treeBuilder's format
        keys.unshift(`${current.type}-${current.refId}`);
        if (!current.parentId) break;
        current = resourceMap.get(current.parentId);
      }

      return keys;
    },
    [resources],
  );

  /**
   * Update resource by id
   * @param id Resource ID
   * @param updates Partial updates to apply
   */
  const updateResource = useCallback(
    async (id: string, updates: Partial<ResourceItem>) => {
      if (!appId) return;

      try {
        await resourceCache.updateResource(appId, id, updates);
        // Resources will be updated via subscribe callback
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        console.error('[useResourceCache] Update failed:', error);
        throw error;
      }
    },
    [appId],
  );

  /**
   * Delete resource by id
   * @param id Resource ID
   */
  const deleteResource = useCallback(
    async (id: string) => {
      if (!appId) return;

      try {
        await resourceCache.deleteResource(appId, id);
        // Resources will be updated via subscribe callback
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        console.error('[useResourceCache] Delete failed:', error);
        throw error;
      }
    },
    [appId],
  );

  /**
   * Add child resource to local cache
   * @param parentId Parent resource ID (null for root)
   * @param resource New resource to add
   */
  const addChildResource = useCallback(
    async (parentId: string | null, resource: ResourceItem) => {
      if (!appId) return;

      try {
        // await resourceCache.addChildResource(appId, resource);
        await resourceCache.syncFromNetwork(appId, parentId || undefined);
        // Resources list will be updated via the global cache subscription
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        console.error('[useResourceCache] Add to cache failed:', error);
        throw error;
      }
    },
    [appId],
  );

  /**
   * Load resources on mount and subscribe to updates
   */
  useEffect(() => {
    if (!appId) {
      setResources([]);
      setIsLoading(false);
      return;
    }

    let active = true;

    const loadResources = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const data = await resourceCache.getResources(appId, memoOptions);

        if (active) {
          setResources(data);
        }
      } catch (err) {
        if (active) {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          console.error('[useResourceCache] Load failed:', error);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    // Subscribe to cache updates
    const unsubscribe = resourceCache.subscribe(appId, (updatedResources) => {
      if (active) {
        setResources(updatedResources);
        setIsSyncing(false);
      }
    });

    loadResources();

    // Cleanup
    return () => {
      active = false;
      unsubscribe();
    };
  }, [appId, memoOptions]);

  /**
   * Track syncing state for cache-first mode
   */
  useEffect(() => {
    if (appId && memoOptions.mode === 'cache-first' && resources.length > 0) {
      setIsSyncing(true);
    }
  }, [appId, memoOptions.mode, resources.length]);

  return {
    resources,
    treeData,
    isLoading,
    isSyncing,
    error,
    refresh,
    clearCache,
    getResourceById,
    getExpandedKeys,
    updateResource,
    deleteResource,
    addChildResource,
  };
}
