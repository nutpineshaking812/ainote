/**
 * Resource metadata from server
 */
export interface ResourceMeta {
  name: string;
  desc?: string;
  icon?: string;
}

/**
 * Resource item from server API
 */
export interface ResourceItem {
  id: string;
  refId: string;
  type: 'form' | 'view' | 'document';
  parentId: string | null;
  order: string | number;
  hidden: boolean;
  pinned: boolean;
  updatedAt: string;
  meta: ResourceMeta;
}

/**
 * Tree node representation of a resource
 */
export interface ResourceTreeNode {
  key: string;
  title: string;
  data: ResourceItem;
  children?: ResourceTreeNode[];
  isLeaf: boolean;
}

/**
 * Fetch mode for cache operations
 * - only-cache: Only read from cache, no network request
 * - only-network: Only fetch from network, update cache
 * - cache-first: Return cache immediately, sync in background (default)
 */
export type FetchMode = 'only-cache' | 'only-network' | 'cache-first';

/**
 * Options for resource cache fetching
 */
export interface ResourceCacheOptions {
  mode?: FetchMode;
}

/**
 * Sync response from server
 */
export interface SyncResponse {
  items: ResourceItem[];
  deletedIds: string[]; // IDs of soft-deleted resources
  timestamp: number;
}

/**
 * Callback for resource updates
 */
export type ResourceUpdateCallback = (resources: ResourceItem[]) => void;
