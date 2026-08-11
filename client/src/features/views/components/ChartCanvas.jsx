import React, { useCallback } from 'react';
import GridLayout, { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import { Empty, Button, Tooltip, Popconfirm } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import ComponentDataChart from '../../../components/chart/ComponentDataChart.jsx';
import './ChartCanvas.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

/**
 * ChartCanvas
 * @param {Array} charts - [{ id, chartType, dataSource, isTable, componentId }]
 * @param {Function} onChartsChange - called with updated charts after layout change or removal
 */
export default function ChartCanvas({ charts = [], onChartsChange }) {
  const { t } = useTranslation();

  // Use existing layout from charts or compute default
  const layouts = {
    lg: charts.map((c, idx) => ({
      i: c.id,
      x: c.layout?.x ?? c.x ?? idx % 4,
      y: c.layout?.y ?? c.y ?? Infinity,
      w: c.layout?.w ?? c.w ?? (c.isTable ? 2 : 1),
      h: c.layout?.h ?? c.h ?? (c.isTable ? 10 : 9),
    })),
  };

  const handleLayoutChange = (currentLayout) => {
    // Map layout changes back to charts
    if (!onChartsChange) return;
    const layoutMap = new Map(currentLayout.map((l) => [l.i, l]));
    const updatedCharts = charts.map((c) => {
      const layoutItem = layoutMap.get(c.id);
      if (layoutItem) {
        return {
          ...c,
          layout: {
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h,
          },
        };
      }
      return c;
    });
    onChartsChange(updatedCharts);
  };

  const handleRemove = useCallback(
    (chart) => {
      const id = chart.id;
      const next = charts.filter((c) => c.id !== id);
      onChartsChange?.(next);
    },
    [charts, onChartsChange],
  );

  return (
    <div className="chart-canvas-root">
      {!charts.length ? (
        <div className="chart-canvas-empty">
          <Empty
            description={
              <span>
                {t('dashboard.emptyCanvas')}
                <br />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  {t('dashboard.dashboardViewTip')}
                </span>
              </span>
            }
          />
        </div>
      ) : (
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          // All breakpoints share the same 4-column structure now
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 4, md: 4, sm: 4, xs: 4, xxs: 4 }}
          rowHeight={24}
          isResizable
          isDraggable
          onLayoutChange={handleLayoutChange}
          margin={[12, 12]}
          containerPadding={[12, 12]}
          draggableHandle=".chart-item-drag-handle"
        >
          {charts.map((c) => (
            <div key={c.id} className="chart-item">
              <ComponentDataChart
                componentId={c.componentId}
                initialData={c.dataSource}
                handleRemove={() => {
                  handleRemove(c);
                }}
              />
            </div>
          ))}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}
