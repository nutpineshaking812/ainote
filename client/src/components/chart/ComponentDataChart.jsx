import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Card, Spin, Result, Button, Table, Popconfirm, Tooltip } from 'antd';
import { PieChartOutlined, TableOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import EChartsComponent from './EChartsComponent.jsx';
import { getComponentData, updateComponent } from '../../api/components.js';
import EditableTitle from '../common/EditableTitle.jsx';
import { useTranslation } from 'react-i18next';

/**
 * ComponentDataChart
 * Props:
 * - componentId (string): ViewComponent id
 * - dataSource (object): optional external data source to override fetch
 * - autoRefreshMs (number|null): optional polling interval
 */
export default function ComponentDataChart({
  key,
  componentId,
  initialData = null,
  autoRefreshMs = null,
  handleRemove,
  handleAdd,
  actions,
  showHeader = true,
}) {
  const [data, setData] = useState(initialData); // { title, chartType, data }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const handleTitleChange = async (newTitle) => {
    if (!newTitle || newTitle.trim() === '') return;
    
    // 1. Update current local UI state
    setData((prev) => (prev ? { ...prev, title: newTitle } : { title: newTitle }));
    
    // 2. Sync to backend database if componentId is available
    if (componentId) {
      try {
        await updateComponent(componentId, { name: newTitle });
      } catch (e) {
        console.error('Failed to sync updated title to server:', e);
      }
    }
  };

  const load = useCallback(async () => {
    if (initialData) return;
    if (!componentId) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await getComponentData(componentId);
      //   console.log('ComponentDataChart load, payload:', payload);
      setData(payload);
    } catch (e) {
      setError(e.message || '加载失败');
      //   console.error('ComponentDataChart load error:', e);
    } finally {
      setLoading(false);
    }
  }, [componentId]);

  // Initial & polling load
  useEffect(() => {
    load();
    if (autoRefreshMs && autoRefreshMs > 0 && !initialData) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(load, autoRefreshMs);
      return () => clearInterval(pollRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load, autoRefreshMs]);

  const renderBody = () => {
    if (!data || loading) {
      return (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <Spin />
        </div>
      );
    }
    if (error) {
      return (
        <Result
          status="error"
          title="加载失败"
          subTitle={error}
          extra={
            <Button type="primary" onClick={load}>
              重试
            </Button>
          }
        />
      );
    }
    if (data && data.chartType === 'table') {
      const cols = data.columns || [];
      const rows = data.dataSource || [];
      if (!rows.length) {
        return (
          <Result
            status="warning"
            title="无数据"
            subTitle="表格数据为空"
            extra={<Button onClick={load}>刷新</Button>}
          />
        );
      }
      return (
        <Table
          size="small"
          columns={cols}
          dataSource={rows}
          rowKey={(r, idx) => `${componentId || 'ds'}-row-${idx}`}
          pagination={{ hideOnSinglePage: true }}
          scroll={{ x: 'max-content' }}
        />
      );
    }
    return <EChartsComponent type={data.chartType} option={data.dataSource} />;
  };

  function getComponentIcon(chartType) {
    switch ((chartType || 'bar').toLowerCase()) {
      case 'table':
        return <TableOutlined />;
      default:
        return <PieChartOutlined />;
    }
  }

  const renderTitle = () => {
    const { t } = useTranslation();
    return (
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          padding: '6px 8px',
          borderBottom: '1px solid #f5f5f5',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <div
          className="chart-item-drag-handle"
          style={{ display: 'flex', justifyContent: 'center' }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              color: '#555',
              padding: 4,
              marginRight: 4,
            }}
          >
            {getComponentIcon(data?.chartType)}
          </span>
          <span style={{ flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'center' }}>
            <EditableTitle
              value={data?.title || t('viewResourcePanel.chart')}
              onSave={handleTitleChange}
              level={5}
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: '#333',
                border: 'none',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                background: 'transparent',
              }}
            />
          </span>
        </div>
        <div className="chart-item-actions">
          {actions}
          {handleRemove && (
            <Popconfirm
              title="确认删除此图表?"
              description="保存之后该操作不可撤销。"
              okText="删除"
              cancelText="取消"
              placement="left"
              onConfirm={handleRemove}
            >
              <Tooltip title="删除">
                <Button size="small" danger type="text" icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {showHeader && renderTitle()}
      {renderBody()}
    </>
  );
}
