import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppResources } from '../context/AppResourcesContext';

// Preload mappings for common resource types to improve LCP
export const PRELOAD_MAP = {
  document: () => import('../../../features/documents/components/DocumentResourcePanel'),
  pdf: () => import('../../../features/documents/components/PdfResourcePanel'),
  form: () => import('../../../features/forms/components/FormResourcePanel'),
  view: () => import('../../../features/views/components/ViewResourcePanel'),
  playroom: () => import('../../../features/chat/components/AgentPlayroom'),
};

/**
 * Hook for managing URL routing synchronization with resource selection
 */
const useResourceRouting = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    resources,
    rawResources,
    loadingResources,
    selectedResource,
    selectResource,
    initialSelectionDoneRef,
    isRoutingReady,
    setIsRoutingReady,
    loadResourcePath,
  } = useAppResources();

  const lastHashRef = useRef('');

  // Parse hash to resource object
  // URL format: #/form/:refId where refId is Form._id/View._id/Document._id
  const parseHash = (hash) => {
    const rawHash = (hash || '').trim();
    if (!rawHash.startsWith('#/')) return null;

    const parts = rawHash.slice(2).split('/');
    if (parts.length === 1) {
      if (parts[0] === 'home') return { type: 'home', id: 'home' };
      if (parts[0] === 'playroom') return { type: 'playroom', id: 'playroom' };
    }

    if (parts.length === 2) {
      const type = parts[0];
      const refId = parts[1];
      // Use rawResources (all levels) to find by refId, not resources (root only)
      const resource = rawResources.find((r) => r.type === type && r.refId === refId);
      if (resource) {
        return {
          type: resource.type,
          id: resource.id,
          refId: resource.refId,
        };
      }
    }
    return null;
  };

  // Sync resource to URL
  // URL uses refId (Form._id / View._id / Document._id) for backward compatibility
  const syncToUrl = useCallback(
    (resource, replace = false) => {
      if (!resource || resource.type === 'home' || resource.type === 'playroom') {
        const hash = resource?.type ? `#/${resource.type}` : '';
        navigate({ pathname: location.pathname, hash }, { replace });
        return;
      }
      // Use refId for URL
      const newHash = `#/${resource.type}/${resource.refId || resource.id}`;
      navigate({ pathname: location.pathname, hash: newHash }, { replace });
    },
    [location.pathname, navigate],
  );

  // Helper for stable selection (prevents redundant updates if logically same)
  const safeSelectResource = useCallback(
    (newRes) => {
      // console.log('safeSelectResource', newRes);
      if (!newRes || newRes.type === 'home') {
        if (selectedResource) selectResource(null);
        return;
      }
      // const currentId = selectedResource?.refId || selectedResource?.id;
      // const newId = newRes.refId || newRes.id;
      // if (selectedResource?.type === newRes.type && currentId === newId) {
      //   if (selectedResource._id || !newRes._id) return;
      // }
      selectResource(newRes);
    },
    [selectedResource, selectResource],
  );

  // Initial selection: run once after resources load
  useEffect(() => {
    if (initialSelectionDoneRef.current) return;
    // Wait for resources to be loaded from cache to avoid race conditions
    if (loadingResources) return;

    const parsed = parseHash(location.hash);

    if (parsed) {
      safeSelectResource(parsed);
      // Expand tree to show the selected resource (any type)
      loadResourcePath(parsed.id);
      initialSelectionDoneRef.current = true;
      if (!isRoutingReady) setIsRoutingReady(true);
    } else if (resources.length > 0) {
      // Default to first resource if no valid hash
      const first = resources[0];
      syncToUrl({ type: first.type, refId: first.refId }, true);
      safeSelectResource({ type: first.type, id: first.id, refId: first.refId });
      initialSelectionDoneRef.current = true;
      if (!isRoutingReady) setIsRoutingReady(true);
    } else {
      // Fallback: No valid hash and no resources in the list (default to home/null selected resource)
      safeSelectResource(null);
      initialSelectionDoneRef.current = true;
      if (!isRoutingReady) setIsRoutingReady(true);
    }
  }, [loadingResources, resources, location.hash, isRoutingReady, loadResourcePath, safeSelectResource, syncToUrl]);

  // Ongoing hash synchronization (after initial selection)
  useEffect(() => {
    // console.log('useResourceRouting', location.hash);
    if (!initialSelectionDoneRef.current) return;
    if (loadingResources) return;

    const rawHash = location.hash || '';
    if (rawHash === lastHashRef.current) return; // avoid duplicate processing

    lastHashRef.current = rawHash;
    const parsed = parseHash(rawHash);
    // console.log('parsed', parsed);

    if (!resources.length) {
      if (parsed) {
        safeSelectResource(parsed);
        loadResourcePath(parsed.id);
      }
      return;
    }

    if (parsed) {
      // Always update selection based on URL (single source of truth)
      safeSelectResource(parsed);

      // Load resource path for tree expansion
      loadResourcePath(parsed.id);
    } else {
      // No hash: select null (Home)
      safeSelectResource(null);
    }
  }, [location.hash, resources, loadingResources, safeSelectResource, loadResourcePath, syncToUrl]);

  // Preload chunks based on hash to improve LCP
  useEffect(() => {
    const hash = location.hash;
    if (!hash.startsWith('#/')) return;
    const type = hash.slice(2).split('/')[0];
    if (PRELOAD_MAP[type]) {
      // console.log(`[useResourceRouting] Preloading chunk for: ${type}`);
      PRELOAD_MAP[type]();
    }
  }, [location.hash]);

  return {
    parseHash,
    syncToUrl,
  };
};

export default useResourceRouting;
