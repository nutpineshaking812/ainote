/**
 * Dock DataProvider 工厂
 *
 * 策略模式：将 Dock 层的数据获取/持久化策略封装为可互换的对象。
 * AgentDockContext 不再需要感知 isOpenMode，只需调用 dataProvider 的方法。
 *
 * ── DockDataProvider 契约 ──
 * {
 *   loadEmployees: (appId, scenario) => Promise<Employee[]>,
 *   restoreDockState: (targetId, userId) => Promise<State | null>,
 *   persistDockState: (targetId, userId, state, scenario) => Promise<void>,
 * }
 */

import { getDigitalEmployees } from '../../../api/digital-employees';
import { getEmployees as getOpenApiEmployees } from '../../../api/openApi';
import { getAgentDockState, updateAgentDockState } from '../../../api/agent-dock';

/**
 * @param {'internal'|'open'}  mode
 * @returns {DockDataProvider}
 */
export function createDockDataProvider(mode) {
  if (mode === 'open') {
    return createOpenDockProvider();
  }
  return createInternalDockProvider();
}

// ──────────────── 内部模式（axios + Cookie JWT）───────────────

function createInternalDockProvider() {
  return {
    // ── 员工列表 ──
    loadEmployees: async (appId, scenario) => {
      try {
        const res = await getDigitalEmployees(appId, scenario);
        return Array.isArray(res) ? res : [];
      } catch (err) {
        console.warn('[InternalDock] loadEmployees failed:', err?.message);
        return [];
      }
    },

    // ── 状态恢复（后端 API → localStorage 降级）──
    restoreDockState: async (targetId, userId) => {
      try {
        // 1. 优先尝试从后端获取持久化的 Dock 状态
        let savedState = null;
        try {
          const backendState = await getAgentDockState(targetId);
          if (backendState) {
            savedState = backendState;
          }
        } catch (err) {
          console.warn('[InternalDock] Failed to fetch dock state from backend, trying localStorage:', err);
        }

        // 2. 如果后端没有状态，降级尝试从 localStorage 读取
        if (!savedState) {
          const storageKey = `agentDockState:${targetId}:${userId}`;
          const savedStateRaw = localStorage.getItem(storageKey);
          if (savedStateRaw) {
            savedState = JSON.parse(savedStateRaw);
          }
        }

        return savedState || null;
      } catch (err) {
        console.warn('[InternalDock] restoreDockState failed:', err);
        return null;
      }
    },

    // ── 状态持久化（localStorage + 后端 API）──
    persistDockState: async (targetId, userId, state, scenario) => {
      try {
        // 1. 同步到 LocalStorage (秒级本地实时备份/高可用)
        const storageKey = `agentDockState:${targetId}:${userId}`;
        const stateToSave = {
          dockEmployeeIds: state.dockEmployeeIds,
          activeEmployeeId: state.activeEmployeeId,
        };
        localStorage.setItem(storageKey, JSON.stringify(stateToSave));

        // 2. 异步同步到后端 PostgreSQL
        updateAgentDockState({
          targetId,
          scenario,
          dockEmployeeIds: state.dockEmployeeIds,
          activeEmployeeId: state.activeEmployeeId,
        }).catch((err) => {
          console.warn('[InternalDock] Failed to persist dock state to backend:', err);
        });
      } catch (err) {
        console.warn('[InternalDock] persistDockState failed:', err);
      }
    },
  };
}

// ──────────────── 开放模式（fetch + localStorage JWT）───────────────

function createOpenDockProvider() {
  const getToken = () => localStorage.getItem('token');

  return {
    // ── 员工列表 ──
    loadEmployees: async (appId, scenario) => {
      const token = getToken();
      if (!token) {
        console.warn('[OpenDock] No auth token, skipping');
        return [];
      }
      try {
        const data = await getOpenApiEmployees(appId, token, { scenario });
        return Array.isArray(data) ? data : [];
      } catch (err) {
        console.warn('[OpenDock] loadEmployees failed:', err?.message);
        return [];
      }
    },

    // ── 状态恢复（嵌入模式不持久化，直接返回 null）──
    restoreDockState: async () => null,

    // ── 状态持久化（嵌入模式跳过，仅维护内存引用）──
    persistDockState: async () => {
      // 嵌入模式：每次都是全新会话，不写 localStorage / 后端
    },
  };
}

export default createDockDataProvider;
