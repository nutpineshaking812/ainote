import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useResourceCache } from '../useResourceCache';
import { resourceCache } from '../../ResourceCache';

// Mock the ResourceCache
vi.mock('../../ResourceCache', () => ({
  resourceCache: {
    initialize: vi.fn(),
    getResources: vi.fn(),
    syncFromNetwork: vi.fn(),
    subscribe: vi.fn(),
    clearApp: vi.fn(),
  },
}));

describe('useResourceCache Hook', () => {
  const mockAppId = 'test-app-123';
  const mockResources = [
    {
      id: '1',
      refId: 'ref-1',
      type: 'form',
      parentId: null,
      order: 0,
      hidden: false,
      pinned: false,
      isLeaf: true,
      updatedAt: '2024-01-01T00:00:00Z',
      meta: { name: 'Form 1', desc: 'Test form' },
    },
    {
      id: '2',
      refId: 'ref-2',
      type: 'document',
      parentId: null,
      order: 1,
      hidden: false,
      pinned: false,
      isLeaf: false,
      updatedAt: '2024-01-01T00:00:00Z',
      meta: { name: 'Document 1', desc: 'Test doc' },
    },
    {
      id: '3',
      refId: 'ref-3',
      type: 'document',
      parentId: '2',
      order: 0,
      hidden: false,
      pinned: false,
      isLeaf: true,
      updatedAt: '2024-01-01T00:00:00Z',
      meta: { name: 'Sub Document', desc: '' },
    },
  ];

  let unsubscribeMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    unsubscribeMock = vi.fn();

    vi.mocked(resourceCache.getResources).mockResolvedValue(mockResources);
    vi.mocked(resourceCache.syncFromNetwork).mockResolvedValue(mockResources);
    vi.mocked(resourceCache.subscribe).mockReturnValue(unsubscribeMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Loading', () => {
    it('should load resources on mount with cache-first mode by default', async () => {
      const { result } = renderHook(() => useResourceCache(mockAppId));

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.resources).toEqual([]);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should call getResources with cache-first mode (default)
      expect(resourceCache.getResources).toHaveBeenCalledWith(mockAppId, {});
      expect(result.current.resources).toEqual(mockResources);
    });

    it('should not load when appId is null', () => {
      const { result } = renderHook(() => useResourceCache(null));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.resources).toEqual([]);
      expect(resourceCache.getResources).not.toHaveBeenCalled();
    });

    it('should build tree data from flat resources', async () => {
      const { result } = renderHook(() => useResourceCache(mockAppId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.treeData).toBeDefined();
      expect(result.current.treeData.length).toBe(2); // Two root nodes

      // Check tree structure
      const docNode = result.current.treeData.find((node) => node.data.id === '2');
      expect(docNode).toBeDefined();
      expect(docNode?.children).toBeDefined();
      expect(docNode?.children?.length).toBe(1); // One child
      expect(docNode?.children?.[0].data.id).toBe('3');
    });
  });

  describe('Fetch Modes', () => {
    it('should support only-cache mode', async () => {
      const { result } = renderHook(() => useResourceCache(mockAppId, { mode: 'only-cache' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(resourceCache.getResources).toHaveBeenCalledWith(mockAppId, {
        mode: 'only-cache',
      });
    });

    it('should support only-network mode', async () => {
      const { result } = renderHook(() => useResourceCache(mockAppId, { mode: 'only-network' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(resourceCache.getResources).toHaveBeenCalledWith(mockAppId, {
        mode: 'only-network',
      });
    });

    it('should support cache-first mode explicitly', async () => {
      const { result } = renderHook(() => useResourceCache(mockAppId, { mode: 'cache-first' }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(resourceCache.getResources).toHaveBeenCalledWith(mockAppId, {
        mode: 'cache-first',
      });
    });
  });

  describe('Subscription Mechanism', () => {
    it('should subscribe to cache updates on mount', async () => {
      renderHook(() => useResourceCache(mockAppId));

      await waitFor(() => {
        expect(resourceCache.subscribe).toHaveBeenCalledWith(mockAppId, expect.any(Function));
      });
    });

    it('should update resources when cache notifies subscribers', async () => {
      let subscriberCallback: any;
      vi.mocked(resourceCache.subscribe).mockImplementation((appId, callback) => {
        subscriberCallback = callback;
        return unsubscribeMock;
      });

      const { result } = renderHook(() => useResourceCache(mockAppId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Simulate cache update
      const updatedResources = [
        ...mockResources,
        {
          id: '4',
          refId: 'ref-4',
          type: 'view',
          parentId: null,
          order: 2,
          hidden: false,
          pinned: false,
          isLeaf: true,
          updatedAt: '2024-01-02T00:00:00Z',
          meta: { name: 'View 1', desc: '' },
        },
      ];

      subscriberCallback(updatedResources);

      await waitFor(() => {
        expect(result.current.resources.length).toBe(4);
      });
    });

    it('should unsubscribe on unmount', async () => {
      const { unmount } = renderHook(() => useResourceCache(mockAppId));

      await waitFor(() => {
        expect(resourceCache.subscribe).toHaveBeenCalled();
      });

      unmount();

      expect(unsubscribeMock).toHaveBeenCalled();
    });

    it('should setup subscription before loading resources', async () => {
      const callOrder: string[] = [];

      vi.mocked(resourceCache.subscribe).mockImplementation(() => {
        callOrder.push('subscribe');
        return unsubscribeMock;
      });

      vi.mocked(resourceCache.getResources).mockImplementation(async () => {
        callOrder.push('getResources');
        return mockResources;
      });

      renderHook(() => useResourceCache(mockAppId));

      await waitFor(() => {
        expect(callOrder).toEqual(['subscribe', 'getResources']);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle loading errors gracefully', async () => {
      const error = new Error('Network error');
      vi.mocked(resourceCache.getResources).mockRejectedValue(error);

      const { result } = renderHook(() => useResourceCache(mockAppId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toEqual(error);
      expect(result.current.resources).toEqual([]);
    });

    it('should handle tree building errors', async () => {
      // Create circular reference (invalid tree)
      const invalidResources = [
        { ...mockResources[0], parentId: '2' },
        { ...mockResources[1], id: '2', parentId: '1' },
      ];

      vi.mocked(resourceCache.getResources).mockResolvedValue(invalidResources);

      const { result } = renderHook(() => useResourceCache(mockAppId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should return empty tree on error
      expect(result.current.treeData).toEqual([]);
    });
  });

  describe('Manual Operations', () => {
    it('should refresh resources manually', async () => {
      const { result } = renderHook(() => useResourceCache(mockAppId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      vi.mocked(resourceCache.syncFromNetwork).mockResolvedValue([
        ...mockResources,
        {
          id: '5',
          refId: 'ref-5',
          type: 'form',
          parentId: null,
          order: 3,
          hidden: false,
          pinned: false,
          isLeaf: true,
          updatedAt: '2024-01-03T00:00:00Z',
          meta: { name: 'New Form', desc: '' },
        },
      ]);

      await result.current.refresh();

      expect(resourceCache.syncFromNetwork).toHaveBeenCalledWith(mockAppId);
      expect(result.current.resources.length).toBe(4);
    });

    it('should clear cache', async () => {
      const { result } = renderHook(() => useResourceCache(mockAppId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.clearCache();

      expect(resourceCache.clearApp).toHaveBeenCalledWith(mockAppId);
      expect(result.current.resources).toEqual([]);
    });

    it('should handle refresh errors', async () => {
      const { result } = renderHook(() => useResourceCache(mockAppId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const error = new Error('Sync failed');
      vi.mocked(resourceCache.syncFromNetwork).mockRejectedValue(error);

      await result.current.refresh();

      expect(result.current.error).toEqual(error);
    });
  });

  describe('Cleanup and Memory Leaks', () => {
    it('should not update state after unmount', async () => {
      let subscriberCallback: any;
      vi.mocked(resourceCache.subscribe).mockImplementation((appId, callback) => {
        subscriberCallback = callback;
        return unsubscribeMock;
      });

      const { result, unmount } = renderHook(() => useResourceCache(mockAppId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      unmount();

      // Try to update after unmount - should not cause errors
      subscriberCallback([...mockResources]);

      // No error should be thrown
      expect(true).toBe(true);
    });

    it('should cancel pending operations on unmount', async () => {
      vi.mocked(resourceCache.getResources).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockResources), 1000)),
      );

      const { unmount } = renderHook(() => useResourceCache(mockAppId));

      // Unmount before loading completes
      unmount();

      // Should unsubscribe
      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  describe('Re-render Behavior', () => {
    it('should reload when appId changes', async () => {
      const { result, rerender } = renderHook(({ appId }) => useResourceCache(appId), {
        initialProps: { appId: mockAppId },
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(resourceCache.getResources).toHaveBeenCalledTimes(1);

      // Change appId
      const newAppId = 'new-app-456';
      rerender({ appId: newAppId });

      await waitFor(() => {
        expect(resourceCache.getResources).toHaveBeenCalledWith(newAppId, {});
      });

      expect(resourceCache.getResources).toHaveBeenCalledTimes(2);
    });

    it('should not reload when appId stays the same', async () => {
      const { rerender } = renderHook(() => useResourceCache(mockAppId));

      await waitFor(() => {
        expect(resourceCache.getResources).toHaveBeenCalledTimes(1);
      });

      // Force re-render with same appId
      rerender();

      // Should still only be called once
      expect(resourceCache.getResources).toHaveBeenCalledTimes(1);
    });
  });
});
