import React from 'react';
import { Button, Tooltip, Popconfirm } from 'antd';
import { PlusOutlined, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import GridLayout, { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import ComponentDataChart from './chart/ComponentDataChart.jsx';

const ResponsiveGridLayout = WidthProvider(Responsive);

/**
 * Reusable ViewDisplay component for showing view layouts with charts
 * @param {Object} view - The view object with layout data
 * @param {boolean} readonly - Whether the view is readonly (default: true)
 * @param {Function} onAddToDashboard - Callback when adding chart to dashboard
 * @param {Function} onEditView - Callback when editing the entire view
 * @param {boolean} showActions - Whether to show action buttons (default: true)
 * @param {boolean} showSettings - Whether to show settings button (default: false)
 */
export default function ViewDisplay({
  view,
  readonly = true,
  onAddToDashboard,
  onEditView,
  showHeader = true,
  showActions = true,
  showSettings = false,
}) {
  // const { measureRef, width } = useContainerWidth();
  const { t } = useTranslation();

  if (!view) return null;

  const layoutItems = Array.isArray(view.layout) ? view.layout : [];

  if (!layoutItems.length) {
    return (
      <div style={{ textAlign: 'center', color: '#888', marginTop: 80 }}>
        {t('viewResourcePanel.noComponents')}
      </div>
    );
  }

  // Build grid-layout compatible structure
  const gridLayout = layoutItems.map((l) => ({
    i: l.layoutId || l.componentId,
    x: typeof l.x === 'number' ? l.x : 0,
    y: typeof l.y === 'number' ? l.y : Infinity,
    w: typeof l.w === 'number' ? l.w : 1,
    h: typeof l.h === 'number' ? l.h : 9,
    static: readonly,
  }));

  const headerActions = [];

  if (showSettings && onEditView) {
    headerActions.push(
      <Tooltip key="settings" title="设置">
        <Button
          size="small"
          type="text"
          icon={<SettingOutlined />}
          onClick={() => onEditView(view)}
        />
      </Tooltip>,
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {headerActions.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: 16,
            gap: 8,
          }}
        >
          {headerActions}
        </div>
      )}

      <div>
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: gridLayout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 4, md: 4, sm: 4, xs: 4, xxs: 4 }}
          rowHeight={24}
          isResizable={!readonly}
          isDraggable={!readonly}
        >
          {layoutItems.map((item) => {
            const key = item.layoutId || item.componentId;

            const chartActions =
              showActions && onAddToDashboard ? (
                <Popconfirm
                  title="确认添加此图表到仪表盘?"
                  description="添加之后可以在仪表盘中查看该图表。"
                  okText="确定"
                  cancelText="取消"
                  placement="left"
                  onConfirm={() => onAddToDashboard(item, view)}
                >
                  <Tooltip title="添加到仪表盘">
                    <Button size="small" type="text" icon={<PlusOutlined />} />
                  </Tooltip>
                </Popconfirm>
              ) : null;

            return (
              <div
                key={key}
                style={{
                  border: showHeader ? '1px solid #eee' : 'none',
                  borderRadius: showHeader ? 4 : 0,
                  background: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <ComponentDataChart
                  appId={view.appId}
                  componentId={item.componentId}
                  actions={chartActions}
                  showHeader={showHeader}
                />
              </div>
            );
          })}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}
