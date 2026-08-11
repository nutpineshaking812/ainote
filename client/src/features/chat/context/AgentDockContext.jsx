import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { message } from 'antd';
import { useAuth } from '../../../store/AuthContext';
import { EMPLOYEE_SCENARIOS } from '../../../constants/employee';
import { createDockDataProvider } from '../dataProviders/createDockDataProvider';


export const AgentDockContext = createContext(null);

export const useAgentDock = () => {
  const context = useContext(AgentDockContext);
  if (!context) {
    throw new Error('useAgentDock must be used within an AgentDockProvider');
  }
  return context;
};

export function AgentDockProvider({
  appId,
  targetId,    // 绑定业务对象（当前文档 docId 或表单 formId）
  scenario = EMPLOYEE_SCENARIOS.GENERAL,
  externalUserId, // 外部嵌入模式：通过 API Key 认证的外部用户标识
  apiMode = 'internal', // 'internal' | 'open' — 决定用内部 API 还是 Open API
  employeeIds,  // 可选：白名单过滤，只展示指定 ID 的员工（SDK 嵌入方控制可见范围）
  streamKey,    // 可选：dock 唯一标识，多 dock 场景下区分数据来源
  children,
}) {
  const { user } = useAuth();
  // 以真实用户 ID 做协作者会话物理隔离；未登录时降级为匿名键
  // externalUserId 用于嵌入式场景（外部平台通过 API Key 接入）
  const userId = externalUserId || user?._id || user?.id || 'anonymous';

  // Dock 层数据提供者（策略模式）：封装员工列表/状态恢复/状态持久化的模式差异
  const dockDataProvider = useMemo(() => createDockDataProvider(apiMode), [apiMode]);

  const [allEmployees, setAllEmployees] = useState([]);
  const [dockEmployees, setDockEmployees] = useState([]);
  const [activeEmployee, setActiveEmployee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});

  // 防止初始化阶段的持久化副作用覆盖 localStorage 恢复的状态
  const isInitializedRef = useRef(false);

  // 缓存上一次持久化或恢复的成功状态，避免在数据无实质变化时产生冗余网络请求
  const lastSavedStateRef = useRef({ dockEmployeeIds: [], activeEmployeeId: null });

  // ─────────────────────────────────────────────
  // 1. 拉取当前应用的数字员工列表
  //    内部模式 → GET /api/v1/apps/:appId/digital-employees/get-list
  //    嵌入模式 → GET /api/v1/open/apps/:appId/employees
  // ─────────────────────────────────────────────
  const loadEmployees = useCallback(async () => {
    if (!appId) return;

    setLoading(true);
    try {
      const data = await dockDataProvider.loadEmployees(appId, scenario);

      // 直接根据场景进行比对（同时允许 GENERAL 作为通用助理）
      let filteredData = data.filter((emp) => {
        const empScenario = emp.scenario || EMPLOYEE_SCENARIOS.GENERAL;
        if (empScenario === EMPLOYEE_SCENARIOS.GENERAL) return true;
        return empScenario === scenario;
      });

      // SDK 嵌入方可配置只展示指定 ID 的员工
      if (employeeIds && employeeIds.length > 0) {
        filteredData = filteredData.filter((emp) =>
          employeeIds.includes(emp.id || emp._id),
        );
      }

      setAllEmployees(filteredData);
    } catch (err) {
      console.warn('[AgentDockProvider] Failed to load digital employees:', err?.message);
      setAllEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [appId, scenario, dockDataProvider]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // ─────────────────────────────────────────────
  // 2. 闭环恢复：读取用户上次在该业务对象上挂载的员工配置（优先后端 API，LocalStorage 作为高可用兜底）
  //
  // ★ 外部嵌入模式（apiMode='open'）：跳过服务端持久化恢复，
  //   直接进入冷启动兜底逻辑（单员工自动挂载，多员工展示选择器）。
  // ─────────────────────────────────────────────
  useEffect(() => {
    // 必须等员工列表加载完成且 targetId / userId 有效
    if (!targetId || !userId || allEmployees.length === 0) return;

    let isCurrent = true;

    const restoreSavedState = async () => {
      try {
        const savedState = await dockDataProvider.restoreDockState(targetId, userId);

        if (!isCurrent) return;

        if (savedState) {
          // 恢复 Dock 队列（仅保留仍在 allEmployees 中存在的员工，防止已删员工幽灵残留）
          const restoredDock = allEmployees.filter(
            (e) =>
              Array.isArray(savedState.dockEmployeeIds) &&
              (savedState.dockEmployeeIds.includes(e.id) || savedState.dockEmployeeIds.includes(e._id)),
          );

          if (restoredDock.length > 0) {
            const restoredDockIds = restoredDock.map((e) => e.id || e._id);
            const restoredActive = restoredDock.find(
              (e) => (e.id || e._id) === savedState.activeEmployeeId,
            );
            const restoredActiveId = restoredActive
              ? (restoredActive.id || restoredActive._id)
              : (restoredDock[0].id || restoredDock[0]._id);

            setDockEmployees(restoredDock);
            setActiveEmployee(restoredActive || restoredDock[0]);

            // 写入 Ref，防止初始恢复的数据触发冗余的 POST /update
            lastSavedStateRef.current = {
              dockEmployeeIds: restoredDockIds,
              activeEmployeeId: restoredActiveId,
            };

            isInitializedRef.current = true;
            return;
          }
        }
      } catch (err) {
        console.warn('[AgentDockProvider] Failed to restore saved dock state:', err);
      }

      if (!isCurrent) return;

      // ─── 冷启动兜底：无历史缓存或恢复出空 Dock 时 ───
      const matchedEmployees = allEmployees.filter((emp) => {
        const empScenario = emp.scenario || EMPLOYEE_SCENARIOS.GENERAL;
        return empScenario === scenario;
      });

      // 外部嵌入模式：只填充 Dock 头像，不自动激活员工（避免聊天窗口自动弹出）
      // 内部模式：单员工默认自动激活，保持原有交互行为
      const shouldAutoActivate = apiMode !== 'open' && matchedEmployees.length === 1;

      if (matchedEmployees.length >= 1) {
        const targetEmployee = matchedEmployees[0];
        setDockEmployees(matchedEmployees);
        if (shouldAutoActivate) {
          setActiveEmployee(targetEmployee);
        }
        const targetEmpId = targetEmployee.id || targetEmployee._id;
        lastSavedStateRef.current = {
          dockEmployeeIds: matchedEmployees.map((e) => e.id || e._id),
          activeEmployeeId: shouldAutoActivate ? targetEmpId : null,
        };
      } else {
        setDockEmployees([]);
        setActiveEmployee(null);
        lastSavedStateRef.current = {
          dockEmployeeIds: [],
          activeEmployeeId: null,
        };
      }
      isInitializedRef.current = true;
    };

    restoreSavedState();

    return () => {
      isCurrent = false;
    };
  }, [allEmployees, targetId, userId, dockDataProvider]);

  // ─────────────────────────────────────────────
  // 3. 持久化：Dock 队列 / 激活员工变动时自动同步
  //
  // ★ 外部嵌入模式：仅维护内存状态（lastSavedStateRef），
  //   不写 localStorage / 后端 PostgreSQL。每次嵌入都是全新会话。
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!isInitializedRef.current || !targetId || !userId) return;

    const dockEmployeeIds = dockEmployees.map((e) => e.id || e._id);
    const activeEmployeeId = activeEmployee ? (activeEmployee.id || activeEmployee._id) : null;

    // 浅比较新旧状态，若相同则跳过更新，防止冗余的 API 网络请求
    const isSameDock =
      dockEmployeeIds.length === lastSavedStateRef.current.dockEmployeeIds.length &&
      dockEmployeeIds.every((id, idx) => id === lastSavedStateRef.current.dockEmployeeIds[idx]);
    const isSameActive = activeEmployeeId === lastSavedStateRef.current.activeEmployeeId;

    if (isSameDock && isSameActive) {
      return;
    }

    // 更新本地 Ref 记录（内部模式 + 外部模式都需要，用于去重比较）
    lastSavedStateRef.current = { dockEmployeeIds, activeEmployeeId };

    // 委托给数据提供者处理（内部模式写 localStorage + 后端，开放模式跳过）
    dockDataProvider.persistDockState(targetId, userId, {
      dockEmployeeIds,
      activeEmployeeId,
    }, scenario);
  }, [dockEmployees, activeEmployee, targetId, userId, scenario, dockDataProvider]);

  // ─────────────────────────────────────────────
  // 4. 召唤 / 移出
  // ─────────────────────────────────────────────
  const summonEmployee = useCallback((employee) => {
    if (!employee) return;
    const empId = employee.id || employee._id;
    setDockEmployees((prev) => {
      if (prev.some((e) => (e.id || e._id) === empId)) {
        message.info(`${employee.name} 已经停靠在您的协同坞中`);
        return prev;
      }
      message.success(`成功召唤数字助理 ${employee.name}`);
      return [...prev, employee];
    });
  }, []);

  const dismissEmployee = useCallback(
    (employeeId) => {
      setDockEmployees((prev) => {
        const filtered = prev.filter((e) => (e.id || e._id) !== employeeId);
        const activeId = activeEmployee ? (activeEmployee.id || activeEmployee._id) : null;
        if (activeEmployee && activeId === employeeId) {
          setActiveEmployee(filtered.length > 0 ? filtered[0] : null);
        }
        return filtered;
      });
    },
    [activeEmployee],
  );

  const incrementUnreadCount = useCallback((employeeId) => {
    if (!employeeId) return;
    setUnreadCounts((prev) => ({
      ...prev,
      [employeeId]: (prev[employeeId] || 0) + 1,
    }));
  }, []);

  const clearUnreadCount = useCallback((employeeId) => {
    if (!employeeId) return;
    setUnreadCounts((prev) => {
      if (!prev[employeeId]) return prev;
      const next = { ...prev };
      delete next[employeeId];
      return next;
    });
  }, []);

  // ─────────────────────────────────────────────
  // 5. 复合会话 Key（Scenario + TargetId + EmployeeId + UserId）
  // ─────────────────────────────────────────────
  const sessionKey = useMemo(() => {
    if (!activeEmployee || !targetId) return null;
    const activeId = activeEmployee.id || activeEmployee._id;
    return `dockConvo:${scenario}:${targetId}:${activeId}:${userId}`;
  }, [scenario, targetId, activeEmployee, userId]);

  const value = useMemo(
    () => ({
      allEmployees,
      dockEmployees,
      activeEmployee,
      loading,
      sessionKey,
      targetId,
      scenario,
      unreadCounts,
      appId,
      apiMode,
      streamKey,
      setActiveEmployee,
      summonEmployee,
      dismissEmployee,
      incrementUnreadCount,
      clearUnreadCount,
      refreshEmployees: loadEmployees,
    }),
    [
      allEmployees,
      dockEmployees,
      activeEmployee,
      loading,
      sessionKey,
      targetId,
      scenario,
      unreadCounts,
      appId,
      apiMode,
      streamKey,
      summonEmployee,
      dismissEmployee,
      incrementUnreadCount,
      clearUnreadCount,
      loadEmployees,
    ],
  );

  return (
    <AgentDockContext.Provider value={value}>
      {children}
    </AgentDockContext.Provider>
  );
}

export default AgentDockProvider;
