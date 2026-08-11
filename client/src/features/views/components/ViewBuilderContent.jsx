import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { message, Splitter } from 'antd';
import ChartCanvas from './ChartCanvas.jsx';
import { AgentDockProvider } from '../../chat/context/AgentDockContext';
import { AgentDock } from '../../chat/components/AgentDock';
import { AgentWorkspace } from '../../chat/components/AgentWorkspace';
import { EMPLOYEE_SCENARIOS } from '../../../constants/employee';

// ViewBuilderContent encapsulates the chart canvas + AI assistant area used while designing a view.
// Props:
// - appId: application id
// - charts: current charts array
// - setCharts: setter to update chart array in parent
// - onChartsChange: optional callback when charts change
// - setViewData: parent setter to sync charts into viewData
// - initialSuggestions: optional array of assistant items { key, label, payload, data?, title?, description? }
const ViewBuilderContent = ({
  appId,
  viewId,
  charts,
  setCharts,
  setViewData,
  onChartsChange,
  initialSuggestions = [],
}) => {
  // 按 viewId 从 localStorage 读取持久化的最小化状态；如果无记录则等待数据加载决定。
  const storageKey = viewId ? `viewAssistantMin:${viewId}` : null;
  const stored = storageKey ? localStorage.getItem(storageKey) : null;
  const initialFromStorage = stored === 'true' ? true : stored === 'false' ? false : null;
  const [assistantMinimized, setAssistantMinimized] = useState(initialFromStorage);
  const [assistantDisplayMode, setAssistantDisplayMode] = useState('panel');
  const initializedRef = useRef(Boolean(initialFromStorage !== null));
  const [assistantPanelSize, setAssistantPanelSize] = useState(420);

  // 数据加载完成后（charts 变化）如果尚未初始化则根据是否有图表设置并持久化
  useEffect(() => {
    if (!initializedRef.current) {
      if (Array.isArray(charts)) {
        const next = charts.length > 0; // 有图表 => 最小化
        setAssistantMinimized(next);
        if (storageKey) localStorage.setItem(storageKey, String(next));
        initializedRef.current = true;
      }
    }
  }, [charts, storageKey]);

  // 用户交互改变时写入 localStorage
  const handleAssistantMinimizedChange = useCallback(
    (next) => {
      setAssistantMinimized(next);
      if (storageKey) localStorage.setItem(storageKey, String(next));
    },
    [storageKey],
  );

  const onAddChart = useCallback(
    async (msg, sourceSegment) => {
      const seg =
        sourceSegment || msg.segments?.find((s) => s.type === 'chart_data' || s.type === 'chart');
      if (!seg) {
        message.error('未找到图表数据');
        return;
      }
      const rawData = seg.data || seg.text;
      let data = rawData;

      // If text is a string, try parsing it (safety for legacy or direct segments)
      if (typeof rawData === 'string') {
        try {
          data = JSON.parse(rawData);
        } catch (e) {
          console.warn('Failed to parse chart segment data', e);
        }
      }

      // Robust extraction: support both { data: {...} } and {...}
      if (data && typeof data === 'object' && data.data && !data.chartType) {
        data = data.data;
      }

      if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
        message.error('图表数据为空');
        return;
      }

      // Store messageId for later component creation on save
      const messageIdValue = msg.id || msg._id;
      const messageId = messageIdValue ? String(messageIdValue) : null;
      if (!messageId) {
        message.error('缺少消息 ID，无法创建图表');
        return;
      }

      const segmentId = (() => {
        if (!seg) return null;
        const idValue = seg.segmentId || seg._id || seg.id || seg.text?.segmentId || data?.segmentId || null;
        return idValue ? String(idValue) : null;
      })();

      // Generate temporary layoutId for frontend use (backend will generate if not provided)
      const tempLayoutId = `layoutId-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Adapt the AI chart data format to the dashboard component expectation
      let adaptedDataSource = data;
      if (data && data.queryResult) {
        const isTable = (data.chartType || 'table').toLowerCase() === 'table';
        if (isTable) {
          let resolvedColumns = data.columns;
          if (!resolvedColumns && data.columnsConfig) {
            try {
              resolvedColumns = typeof data.columnsConfig === 'string'
                ? JSON.parse(data.columnsConfig)
                : data.columnsConfig;
            } catch (e) {}
          }
          adaptedDataSource = {
            chartType: 'table',
            columns: resolvedColumns,
            dataSource: data.queryResult,
            title: data.chartTitle || '新图表',
          };
        } else {
          // Adapt to ECharts option
          const xKey = data.xAxisKey;
          const yKeys = data.yAxisKeys
            ? (typeof data.yAxisKeys === 'string'
                ? data.yAxisKeys.split(',').map((k) => k.trim())
                : [].concat(data.yAxisKeys))
            : [];
          const echartsOption = {
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: data.queryResult.map((r) => r[xKey] ?? '') },
            yAxis: { type: 'value' },
            series: yKeys.map((yKey) => ({
              name: yKey,
              type: (data.chartType || 'bar').toLowerCase(),
              data: data.queryResult.map((r) => Number(r[yKey]) || 0),
            })),
            title: data.chartTitle ? { text: data.chartTitle } : undefined,
          };
          adaptedDataSource = {
            chartType: (data.chartType || 'bar').toLowerCase(),
            dataSource: echartsOption,
            title: data.chartTitle || '新图表',
          };
        }
      }

      const newChart = {
        id: tempLayoutId, // Use layoutId as chart id
        layoutId: tempLayoutId, // Will be replaced by backend-generated layoutId on save
        chartType: (data.chartType || 'bar').toLowerCase(),
        dataSource: adaptedDataSource, // adapted structure containing { chartType, columns/dataSource }
        title: data.chartTitle || seg.title || '新图表',
        messageId, // store messageId to create component from message on save
        ...(segmentId ? { segmentId } : {}),
        isTable: (data.chartType || 'bar').toLowerCase() === 'table',
      };
      setCharts((prev) => {
        const next = [...prev, newChart];
        if (typeof onChartsChange === 'function') onChartsChange(next);
        return next;
      });
      setViewData((prev) =>
        prev ? { ...prev, charts: [...(prev.charts || []), newChart] } : prev,
      );
      message.success('图表已添加到画布');
    },
    [appId, setCharts, setViewData, onChartsChange],
  );

  // 计算助手是否应该在停靠栏显示 (仅 'panel' 模式下展示侧边栏，避免重挂载)
  const assistantDocked = assistantDisplayMode === 'panel';
  const assistantMinimizedResolved = assistantMinimized ?? false;
  const assistantVisibleInPanel = assistantDocked && !assistantMinimizedResolved;

  const handleSplitterResize = useCallback(
    (...args) => {
      if (!assistantDocked) return;
      const candidate = args[args.length - 1];
      const sizes = Array.isArray(candidate) ? candidate : candidate?.sizes;
      if (!Array.isArray(sizes) || sizes.length < 2) return;
      const nextSize = sizes[sizes.length - 1];
      if (typeof nextSize === 'number' && nextSize > 0) {
        setAssistantPanelSize(nextSize);
      }
    },
    [assistantDocked],
  );

  const chartPanel = (
    <div style={{ flex: 1, display: 'flex', position: 'relative', minWidth: 0 }}>
      <ChartCanvas
        charts={charts}
        onChartsChange={(next) => {
          setCharts(next);
          setViewData((prev) => (prev ? { ...prev, charts: next } : prev));
          if (typeof onChartsChange === 'function') onChartsChange(next);
        }}
      />
      {/* 贴边悬浮 AgentDock 工具栏，点击头像即展开右侧协同面板 */}
      <AgentDock
        placement="right"
        onSelect={() => handleAssistantMinimizedChange(false)}
      />
    </div>
  );

  const viewInitialReferences = useMemo(() => [
    {
      key: 'raw-reference-data',
      label: `当前视图`,
      removable: false,
      type: 'view',
      value: viewId,
    },
  ], [viewId]);

  const assistantPanel = appId ? (
    <AgentWorkspace
      appId={appId}
      minimized={assistantMinimizedResolved}
      onMinimizedChange={handleAssistantMinimizedChange}
      defaultDisplayMode={assistantDisplayMode}
      onDisplayModeChange={setAssistantDisplayMode}
      initialReferences={viewInitialReferences}
      onAddChart={onAddChart}
    />
  ) : null;

  return (
    <AgentDockProvider
      appId={appId}
      targetId={viewId || 'new'}
      scenario={EMPLOYEE_SCENARIOS.VIEW_DESIGN}
    >
      <div style={{ height: '100%', width: '100%' }}>
        {assistantDocked ? (
          <Splitter
            orientation="horizontal"
            style={{ height: '100%' }}
            onResize={handleSplitterResize}
          >
            <Splitter.Panel min={560} style={{ display: 'flex' }}>
              {chartPanel}
            </Splitter.Panel>
            <Splitter.Panel
              min={assistantVisibleInPanel ? 320 : 0}
              size={assistantVisibleInPanel ? assistantPanelSize : 0}
              resizable={assistantVisibleInPanel}
              style={{ display: 'flex', overflow: assistantVisibleInPanel ? 'hidden' : 'visible' }}
            >
              {assistantPanel}
            </Splitter.Panel>
          </Splitter>
        ) : (
          <div style={{ display: 'flex', height: '100%' }}>
            {chartPanel}
            <div style={{ width: 0, height: 0, overflow: 'visible' }}>{assistantPanel}</div>
          </div>
        )}
      </div>
    </AgentDockProvider>
  );
};

export default ViewBuilderContent;
