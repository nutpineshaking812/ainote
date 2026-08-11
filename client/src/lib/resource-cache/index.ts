/**
 * Resource Cache Module
 *
 * Provides local caching for AppResources with SQLite storage,
 * network synchronization, and React integration.
 */

export { resourceCache, ResourceCache } from './ResourceCache';
export { useResourceCache } from './hooks/useResourceCache';
export { buildResourceTree, flattenTree } from './utils/treeBuilder';
export type {
  ResourceItem,
  ResourceMeta,
  ResourceTreeNode,
  FetchMode,
  ResourceCacheOptions,
  SyncResponse,
  ResourceUpdateCallback,
} from './types';
