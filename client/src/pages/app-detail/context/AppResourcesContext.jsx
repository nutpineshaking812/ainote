import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import { message } from 'antd';
import {
  getResources,
  addResource,
  removeResource,
  moveResource,
  updateResourceMeta as apiUpdateResourceMeta,
} from '../../../api/resources';

import { getForm, deleteForm } from '../../../api/forms';
import { deleteView } from '../../../api/views';
import { createDocument, deleteDocument } from '../../../api/documents';
import { useAppPermissions } from '../../../context/AppPermissionContext';
import { useResourceCache } from '../../../lib/resource-cache/hooks/useResourceCache';
import useAppStore from '../../../store/useAppStore';
import { getOrgCategories } from '../../../api/orgCategories';
import { buildResourceTree } from '../../../lib/resource-cache/utils/treeBuilder';
import { generateRank } from '../../../lib/resource-cache/utils/lexorank';

export const AppResourcesContext = createContext(null);

export const useAppResources = () => {
  const context = useContext(AppResourcesContext);
  if (!context) {
    throw new Error('useAppResources must be used within AppResourcesProvider');
  }
  return context;
};

export const AppResourcesProvider = ({ appId, appName, children }) => {
  const siderCollapsed = useAppStore((state) => state.isSidebarCollapsed);
  const setSiderCollapsed = useAppStore((state) => state.setSidebarCollapsed);
  const [selectedResourceId, setSelectedResourceId] = useState(null);
  const [selectedResourceType, setSelectedResourceType] = useState(null);
  const { appPermissions } = useAppPermissions();

  const hasAppPermission = useCallback(
    (permission) => {
      return (appPermissions || []).includes(permission);
    },
    [appPermissions],
  );

  // Expanded keys state (managed locally for UI)
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [tagCategories, setTagCategories] = useState([]);

  const refreshTagCategories = useCallback(async () => {
    try {
      const data = await getOrgCategories();
      setTagCategories(data || []);
    } catch (err) {
      console.error('[AppResourcesContext] Failed to load tags', err);
    }
  }, []);

  useEffect(() => {
    refreshTagCategories();
  }, [refreshTagCategories]);

  // Tree data and caching hook
  const {
    treeData,
    resources: rawResources,
    isLoading: loadingResources,
    refresh: refreshCache,
    addChildResource,
    deleteResource: removeResourceFromCache,
    updateResource: updateResourceInCache,
    getExpandedKeys: getKeysForPath,
    clearCache,
  } = useResourceCache(appId);

  // Sync rawResources to useAppStore for cross-root reference (e.g. CustomDocMentionView)
  useEffect(() => {
    if (rawResources) {
      useAppStore.getState().setAppResources(rawResources);
    }
  }, [rawResources]);

  // Define simplified versions of tree operations for backward compatibility
  const reloadRoots = useCallback(() => refreshCache(), [refreshCache]);
  const reloadNode = useCallback((node) => refreshCache(node.data?.id), [refreshCache]);
  const removeDoc = useCallback((id) => removeResourceFromCache(id), [removeResourceFromCache]);
  const addChildDoc = useCallback(
    (parentKey, doc) => addChildResource(doc.parentId, doc),
    [addChildResource],
  );

  // No-op or simplified versions for other methods
  const loadChildren = useCallback(
    async (node) => {
      // With cache-first, all data is loaded. Optionally forced sync from network.
      await refreshCache(node.data?.id);
    },
    [refreshCache],
  );

  const moveNodeLocally = useCallback(() => {
    // useResourceCache handles updates via atomic operations
    // Deprecated: moveNodeLocally is now handled via updateResource
  }, []);

  const setTreeFromNested = useCallback(() => {
    // No longer needed as tree is built from cache
    // Deprecated: setTreeFromNested is no longer used
  }, []);

  const EXPANDED_KEYS_STORAGE_KEY = `expanded_keys_${appId}`;

  // Initial load of expanded keys from localStorage
  useEffect(() => {
    if (!appId) return;
    const saved = localStorage.getItem(EXPANDED_KEYS_STORAGE_KEY);
    if (saved) {
      try {
        const keys = JSON.parse(saved);
        if (Array.isArray(keys)) {
          setExpandedKeys(keys);
        }
      } catch (e) {
        console.warn('Failed to parse expanded keys from storage', e);
      }
    }
  }, [appId, setExpandedKeys]);

  // Save expanded keys to localStorage on change
  useEffect(() => {
    if (!appId) return;
    // We save even empty array to reflect the fully collapsed state
    localStorage.setItem(EXPANDED_KEYS_STORAGE_KEY, JSON.stringify(expandedKeys));
  }, [appId, expandedKeys]);

  const [loadingNodeKeys, setLoadingNodeKeys] = useState(new Set());
  const initialSelectionDoneRef = useRef(false);
  const [isRoutingReady, setIsRoutingReady] = useState(false);
  const isInitialMount = useRef(true);
  const [searchQuery, setSearchQuery] = useState('');
  // --- Filtering Logic for Memory Resources (Logical Isolation) ---
  const filteredResources = useMemo(() => {
    return (rawResources || []).filter((r) => !(r.meta?.categoryKeys || []).includes('ai_memory'));
  }, [rawResources]);

  const filteredTreeData = useMemo(() => {
    if (filteredResources.length === 0) return [];
    try {
      return buildResourceTree(filteredResources);
    } catch (err) {
      console.error('[AppResourcesContext] Failed to build filtered tree:', err);
      return [];
    }
  }, [filteredResources]);

  // Create plain search nodes (flattened) for matches - also filtered
  const searchNodes = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    return filteredResources
      .filter((r) => (r.meta?.name || r.name || '').toLowerCase().includes(query))
      .map((r) => ({
        key: `${r.type}-${r.refId}`,
        title: r.meta?.name || r.name || '无标题',
        data: {
          ...r,
          _id: r.id, // Compatibility
          refId: r.refId,
        },
        isLeaf: true,
      }));
  }, [searchQuery, filteredResources]);

  // Sync resources list from cache: Return only NON-MEMORY root-level resources
  const resources = useMemo(() => {
    return filteredResources
      .filter((r) => r.parentId === null)
      .map((r) => ({
        id: r.id,
        refId: r.refId,
        type: r.type,
        name: r.meta?.name,
        hidden: r.hidden,
        pinned: r.pinned,
        order: r.order,
      }));
  }, [filteredResources]);

  // Force sider to be expanded if no resources (ignore memory)
  useEffect(() => {
    if (
      !loadingResources &&
      (!filteredTreeData || filteredTreeData.length === 0) &&
      siderCollapsed
    ) {
      setSiderCollapsed(false);
    }
  }, [loadingResources, filteredTreeData, siderCollapsed, setSiderCollapsed]);

  useEffect(() => {
    // Permission sync is handled by AppPermissionProvider
  }, [appId]);

  // Refresh resources (wrapper for external calls)
  const refreshResources = useCallback(async () => {
    return await reloadRoots();
  }, [reloadRoots]);

  // Select a resource
  const selectResource = useCallback((resource) => {
    if (!resource) {
      setSelectedResourceId(null);
      setSelectedResourceType(null);
      return;
    }
    // Handle both object and simplified id/type object
    const id = resource._id || resource.id;
    const type = resource.type;
    setSelectedResourceId(id);
    setSelectedResourceType(type);
  }, []);

  // Derive selectedResource from the list
  const selectedResource = useMemo(() => {
    if (!selectedResourceId) return null;

    // Special handling for virtual/resident resource types (like playroom)
    if (selectedResourceType === 'playroom') {
      return {
        id: 'playroom',
        refId: 'playroom',
        type: 'playroom',
        meta: { name: '圆桌会' },
      };
    }

    // console.log('rawResources', rawResources, selectedResourceId, selectedResourceType);
    const raw = rawResources.find(
      (r) => r.id === selectedResourceId && r.type === selectedResourceType,
    );
    // console.log('raw', raw);
    if (!raw) return null;
    
    // Maintain compatibility: id should be refId for panels
    return {
      ...raw,
      _id: raw.id, // Internal ID
      id: raw.refId, // Public refId
    };
  }, [rawResources, selectedResourceId, selectedResourceType]);

  useEffect(() => {
    if (rawResources.length > 0) {
      console.log('[AppResourcesContext] rawResources updated:', rawResources.length);
    }
  }, [rawResources.length]);

  // Create a new resource
  const createResource = useCallback(
    async (type, data = {}) => {
      try {
        if (type === 'document') {
          const res = await createDocument(
            {
              title: data.title || '',
              purpose: 'NORMAL',
              isResource: true,
              parentId: data.parentId || undefined,
              isSkill: data.isSkill || false,
              skillName: data.skillName || '',
              skillDescription: data.skillDescription || '',
              skillParameters: data.skillParameters || {},
            },
            { appId },
          );
          const doc = res?.data || res;

          // Only update local cache IF backend succeeded
          await addChildResource(doc.parentId || null, {
            id: doc._id,
            refId: doc._id,
            type: 'document',
            parentId: doc.parentId || null,
            order: doc.order || 0,
            hidden: false,
            pinned: false,
            updatedAt: doc.updatedAt || new Date().toISOString(),
            meta: { 
              name: doc.title || '无标题笔记',
              isSkill: doc.isSkill || false,
              skillName: doc.skillName || '',
              skillDescription: doc.skillDescription || '',
              skillParameters: doc.skillParameters || {},
            },
          });

          return { success: true, data: doc };
        } else if (type === 'folder') {
          // 文件夹直接在 app_resources 表中创建，无需外部关联表
          const name = data.title || '新建文件夹';
          const folderData = {
            type: 'folder',
            parentId: data.parentId || null,
            order: 0,
            hidden: false,
            pinned: false,
            updatedAt: new Date().toISOString(),
            meta: { name: name },
          };

          // 调用后端统一的保存/更新接口
          const res = await addResource(appId, folderData);

          // 更新本地缓存
          await addChildResource(folderData.parentId, folderData);

          return { success: true, data: folderData };
        } else if (type === 'form' || type === 'view') {
          // For form/view creation, caller handles navigation to builder
          // We'll sync from network to get the new resource record
          await refreshCache();
          return { success: true };
        }
      } catch (error) {
        console.error('Failed to create resource', error);
        message.error(
          `创建${type === 'document' ? '笔记' : type === 'form' ? '表单' : '视图'}失败`,
        );
        return { success: false, error };
      }
    },
    [appId, addChildResource, refreshCache],
  );

  const createChildDocumentNode = useCallback(
    async ({ parentId, title = '未命名笔记' } = {}) => {
      if (!parentId) {
        throw new Error('parentId is required to create a child document');
      }

      const payload = {
        title,
        parentId,
        purpose: 'NORMAL',
        appId,
      };

      const createdResp = await createDocument(payload, { appId });
      const docObj = createdResp?.data || createdResp;
      if (!docObj?._id) {
        throw new Error('Failed to create document');
      }

      // Add to local cache only after success
      await addChildResource(parentId, {
        id: docObj._id,
        refId: docObj._id,
        type: 'document',
        parentId,
        order: docObj.order || 0,
        hidden: false,
        pinned: false,
        updatedAt: docObj.updatedAt || new Date().toISOString(),
        meta: { name: docObj.title },
      });

      // Expand the parent node
      const parentKey = `document-${parentId}`;
      setExpandedKeys((keys) => (keys.includes(parentKey) ? keys : [...keys, parentKey]));

      return docObj;
    },
    [appId, addChildResource, setExpandedKeys],
  );

  // Delete a resource
  const deleteResource = useCallback(
    async (type, id) => {
      try {
        // Find resource in cache
        const resource = rawResources.find((r) => r.id === id || r.refId === id);

        if (!resource) {
          message.error('资源不存在');
          return { success: false };
        }

        // Use provided type or fall back to actual resource type
        const actualType = type || resource.type;

        if (actualType === 'document') {
          // Delete actual Document using refId first (Pessimistic Consistency)
          await deleteDocument(appId, resource.refId);
          
          // Remove from local cache only after backend success
          await removeResourceFromCache(resource.id);
          message.success('笔记已删除');
        } else if (actualType === 'form') {
          // Forms are deleted via the specific form API, which handles resource cleanup
          await deleteForm(appId, resource.refId);
          await removeResourceFromCache(resource.id);
          message.success('表单已删除');
        } else if (actualType === 'view') {
          // Views are deleted via the specific view API, which handles resource cleanup
          await deleteView(appId, resource.refId);
          await removeResourceFromCache(resource.id);
          message.success('视图已删除');
        } else if (actualType === 'folder') {
          // Folders only exist in the resource tree
          await removeResource(appId, { type: 'folder', refId: resource.refId });
          await removeResourceFromCache(resource.id);
          message.success('文件夹已删除');
        } else {
          // Generic resources (files, etc.)
          await removeResource(appId, { type: actualType, refId: resource.refId });
          await removeResourceFromCache(resource.id);
          message.success('资源已删除');
        }

        return { success: true };
      } catch (error) {
        console.error('Delete resource failed:', error);
        const msg =
          error.response?.data?.error?.message ||
          error.response?.data?.message ||
          '删除失败';
        message.error(msg);
        return { success: false, error };
      }
    },
    [appId, rawResources, removeResourceFromCache],
  );

  // Search/filter resources
  const filterResources = useCallback((searchValue) => {
    setSearchQuery(searchValue);
  }, []);

  // Expand tree node with lazy loading support (now syncs from cache)
  const handleTreeExpand = useCallback(
    async (nextKeys, info) => {
      setExpandedKeys(nextKeys);

      const newly =
        info?.expanded && info?.node
          ? [info.node.key]
          : (nextKeys || []).filter((k) => !expandedKeys.includes(k));

      for (const key of newly) {
        // Extract ID from key (e.g., 'document-123' -> '123')
        const id = key.split('-').pop();
        if (!id) continue;

        const resource = rawResources.find((r) => r.id === id || r.refId === id);
        if (!resource || resource.type !== 'document') continue;

        if (loadingNodeKeys.has(key)) continue;

        setLoadingNodeKeys((prev) => new Set(prev).add(key));
        try {
          // Trigger background sync for this folder if needed (use the link id)
          await refreshCache(resource.id);
        } catch (e) {
          console.warn('加载子笔记失败', e);
        } finally {
          setLoadingNodeKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      }
    },
    [expandedKeys, rawResources, loadingNodeKeys, refreshCache],
  );

  const handleMoveResource = useCallback(
    async ({ nodeId, newParentId, newOrder }) => {
      try {
        // 1. Find the target parent's children in current tree
        const findSiblings = (nodes, pid) => {
          if (pid === null || pid === 'root') return nodes;
          for (const node of nodes) {
            if (node.data.id === pid) return node.children || [];
            if (node.children) {
              const result = findSiblings(node.children, pid);
              if (result) return result;
            }
          }
          return null;
        };

        const siblings = findSiblings(treeData, newParentId) || [];
        // Filter out the node itself if it's already in the parent
        const otherSiblings = siblings.filter(s => s.data.id !== nodeId);

        // 2. Determine neighbor ranks
        const prevSibling = otherSiblings[newOrder - 1];
        const nextSibling = otherSiblings[newOrder];

        const prevRank = prevSibling?.data.order || '';
        const nextRank = nextSibling?.data.order || '';

        // 3. Calculate new rank
        const newRank = generateRank(prevRank, nextRank);

        // 4. Optimistic Update Local Cache
        await updateResourceInCache(nodeId, {
          parentId: newParentId,
          order: newRank,
        });

        // 5. Send to backend (just success/failure expected)
        await moveResource(appId, nodeId, newParentId, newRank);
        
        console.log('[AppResourcesContext] Move persisted to backend');
      } catch (e) {
        console.error('Failed to move resource', e);
        message.error('移动失败');
        // Optionally: refresh cache from server to revert optimistic update
        refreshCache();
      }
    },
    [appId, treeData, updateResourceInCache, refreshCache],
  );

  const forceSync = useCallback(async () => {
    try {
      message.loading({ content: '正在同步...', key: 'force-sync' });
      // 不清除缓存，直接发起 refreshCache 进行增量与覆盖更新，避免右侧文档闪烁重新加载
      await refreshCache();
      message.success({ content: '同步成功', key: 'force-sync' });
    } catch (e) {
      console.error('Force sync failed', e);
      message.error({ content: '同步失败', key: 'force-sync' });
    }
  }, [refreshCache]);

  const handleUpdateResourceMeta = useCallback(
    async (type, refId, meta) => {
      try {
        const response = await apiUpdateResourceMeta(appId, { type, refId, meta });
        // Success, update local cache
        // Find the resource id from cache (AppResources._id)
        const resource = rawResources.find((r) => r.type === type && r.refId === refId);
        if (resource) {
          await updateResourceInCache(resource.id, { meta: { ...resource.meta, ...meta } });
        }
        return { success: true, data: response };
      } catch (error) {
        console.error('Failed to update resource meta', error);
        message.error('更新失败');
        return { success: false, error };
      }
    },
    [appId, rawResources, updateResourceInCache],
  );

  /**
   * Update local cache only (no API call).
   * Used when backend is already updated (e.g., after title auto-save) and we just
   * need to refresh the tree display via the ResourceCache.
   */
  const updateResourceCacheMeta = useCallback(
    async (type, refId, meta) => {
      const resource = rawResources.find((r) => r.type === type && r.refId === refId);
      if (resource) {
        await updateResourceInCache(resource.id, { meta: { ...resource.meta, ...meta } });
      }
    },
    [rawResources, updateResourceInCache],
  );

  // Load resource path for tree expansion
  const loadResourcePath = useCallback(
    async (resourceId) => {
      if (!resourceId) return;

      // Calculate path using cache
      const path = getKeysForPath(resourceId);

      if (path && path.length > 0) {
        setExpandedKeys((prev) => {
          const next = new Set(prev);
          path.forEach((k) => next.add(k));
          return Array.from(next);
        });
      } else if (isInitialMount.current) {
        // Not found locally, it might be new or not synced.
        // Try to refresh from server and re-calculate.
        try {
          await refreshCache();
          const newPath = getKeysForPath(resourceId);
          if (newPath && newPath.length > 0) {
            setExpandedKeys((prev) => {
              const next = new Set(prev);
              newPath.forEach((k) => next.add(k));
              return Array.from(next);
            });
          }
        } catch (err) {
          console.warn('Failed to load resource path via refresh', err);
        }
      }
    },
    [getKeysForPath, setExpandedKeys, refreshCache],
  );

  // Reset initial mount flag when appId changes
  useEffect(() => {
    isInitialMount.current = true;
  }, [appId]);

  const value = useMemo(
    () => ({
      // State
      appId,
      appName,
      resources,
      rawResources, // All resources (all levels), for routing lookups
      loadingResources,
      selectedResource,
      treeData: filteredTreeData,
      searchNodes,
      expandedKeys,
      loadingNodeKeys,
      searchQuery,
      initialSelectionDoneRef,
      isRoutingReady,
      setIsRoutingReady,
      appPermissions,
      hasAppPermission,
      tagCategories,
      refreshTagCategories,

      refreshResources,
      selectResource,
      createResource,
      deleteResource,
      filterResources,

      // Tree operations
      handleTreeExpand,
      loadChildren,
      addChildDoc,
      removeDoc,
      reloadRoots,
      reloadNode,
      setExpandedKeys,
      loadResourcePath,
      updateResourceMeta: handleUpdateResourceMeta,
      updateResourceCacheMeta,
      createChildDocumentNode,
      moveResource: handleMoveResource,
      forceSync,

      siderCollapsed,
      setSiderCollapsed,

      // Direct setters (for migration compatibility)
      setSelectedResource: selectResource,
    }),
    [
      loadingResources,
      selectedResource,
      filteredTreeData,
      expandedKeys,
      loadingNodeKeys,
      appPermissions,
      hasAppPermission,
      refreshResources,
      selectResource,
      createResource,
      deleteResource,
      filterResources,
      handleTreeExpand,
      loadChildren,
      addChildDoc,
      removeDoc,
      reloadRoots,
      reloadNode,
      handleUpdateResourceMeta,
      updateResourceCacheMeta,
      tagCategories,
      refreshTagCategories,
      setExpandedKeys,
      loadResourcePath,
      forceSync,
      handleMoveResource,
      createChildDocumentNode,
      siderCollapsed,
      setSiderCollapsed,
      resources,
      rawResources,
      searchQuery,
      searchNodes,
      isRoutingReady,
      appId,
      appName,
    ],
  );

  return <AppResourcesContext.Provider value={value}>{children}</AppResourcesContext.Provider>;
};

export default AppResourcesContext;
