import { create } from 'zustand';

/**
 * Global application store for managing cross-cutting state.
 */
const useAppStore = create((set) => ({
  // State
  currentAppId: null,
  isSidebarCollapsed: false,
  globalLoading: false,
  appResources: [],

  // Actions
  setCurrentAppId: (appId) => set({ currentAppId: appId }),
  setSidebarCollapsed: (collapsed) =>
    set((state) => ({
      isSidebarCollapsed:
        typeof collapsed === 'function' ? collapsed(state.isSidebarCollapsed) : collapsed,
    })),
  setGlobalLoading: (loading) => set({ globalLoading: loading }),
  setAppResources: (resources) => set({ appResources: resources }),

  // Potential for more complex actions
  resetStore: () =>
    set({
      currentAppId: null,
      isSidebarCollapsed: false,
      globalLoading: false,
      appResources: [],
    }),
}));

export default useAppStore;
