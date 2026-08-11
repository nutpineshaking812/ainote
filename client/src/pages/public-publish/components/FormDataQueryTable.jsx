import React, { useState, useEffect, useMemo } from 'react';
import { Input, Button, Space, Table, Tooltip } from 'antd';
import dayjs from 'dayjs';

/**
 * FormDataQueryTable
 * 通用查询表格组件：包含搜索、防抖、分页、动态列生成。
 * Props:
 *  - formSchema: 表单结构 (需含 fields)
 *  - fetchRecords: (q, page, pageSize) => Promise<{ items: [], total: number }> 或数组
 *  - fieldColumnLimit?: 限制展示的 schema 字段数量 (默认 6)
 *  - showCreatedAt?: 是否显示创建时间列 (默认 true)
 *  - selectionMode?: 'none' | 'single'
 *  - selectedId?: 当前选中记录 id
 *  - onSelectionChange?: (record) => void
 *  - reloadSignal?: 任意变化时触发重新加载
 */
const FormDataQueryTable = ({
  formSchema,
  fetchRecords,
  fieldColumnLimit = 6,
  showCreatedAt = true,
  selectionMode = 'none',
  selectedId,
  onSelectionChange,
  reloadSignal,
  pageSize: initialPageSize = 10,
  style,
}) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [total, setTotal] = useState(0);

  const loadData = async (opts = {}) => {
    const { q = searchQuery, pg = page, ps = pageSize } = opts;
    setLoading(true);
    try {
      if (fetchRecords) {
        const res = await fetchRecords(q, pg, ps);
        if (Array.isArray(res)) {
          setRecords(res);
          setTotal(res.length);
        } else if (res && typeof res === 'object') {
          setRecords(res.items || []);
          setTotal(res.total || (res.items ? res.items.length : 0));
        } else {
          setRecords([]);
          setTotal(0);
        }
      } else {
        setRecords([]);
        setTotal(0);
      }
    } catch (e) {
      console.error(e);
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // 初次 / reloadSignal 改变时加载
  useEffect(() => {
    loadData({ pg: 1 });
    setPage(1);
  }, [reloadSignal]);

  // 搜索防抖
  useEffect(() => {
    const handle = setTimeout(() => {
      setPage(1);
      loadData({ q: searchQuery, pg: 1 });
    }, 400);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const columns = useMemo(() => {
    const schemaFields = formSchema?.fields || [];
    const cols = [];
    // ID 列
    cols.push({
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 140,
      ellipsis: true,
      render: (val, row) => val || row._id || '-',
    });

    schemaFields.slice(0, fieldColumnLimit).forEach((f) => {
      cols.push({
        title: f.properties?.label || f.id,
        dataIndex: f.id,
        key: f.id,
        ellipsis: true,
        render: (val) => {
          if (val == null || val === '') return <span style={{ color: '#999' }}>-</span>;
          if (f.type === 'date-picker') {
            const d = dayjs(val);
            return d.isValid() ? d.format('YYYY-MM-DD') : String(val);
          }
          if (Array.isArray(val)) return val.join(', ');
          if (typeof val === 'object') return JSON.stringify(val);
          return String(val);
        },
      });
    });

    if (showCreatedAt) {
      cols.push({
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 170,
        render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
      });
    }
    return cols;
  }, [formSchema, fieldColumnLimit, showCreatedAt]);

  return (
    <Space direction="vertical" style={{ width: '100%', ...(style || {}) }} size={12}>
      <Space align="center" wrap>
        <Input
          placeholder="输入关键字搜索（自动）"
          allowClear
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: 260 }}
        />
        <Button
          size="small"
          onClick={() => {
            setSearchQuery('');
            setPage(1);
            loadData({ q: '', pg: 1 });
          }}
        >
          重置
        </Button>
        <Tooltip title="重新加载数据">
          <Button size="small" onClick={() => loadData({ pg: page })}>
            刷新数据
          </Button>
        </Tooltip>
      </Space>
      <Table
        size="small"
        bordered
        loading={loading}
        dataSource={records}
        columns={columns}
        rowKey={(r) => r.id || r._id}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
            loadData({ pg: p, ps });
          },
        }}
        locale={{ emptyText: '暂无数据' }}
        scroll={{ x: 'max-content' }}
        onRow={
          selectionMode === 'single'
            ? (record) => ({
                onClick: () => {
                  onSelectionChange && onSelectionChange(record);
                },
                style: { cursor: 'pointer' },
              })
            : undefined
        }
        rowSelection={
          selectionMode === 'single'
            ? {
                type: 'radio',
                selectedRowKeys: selectedId ? [selectedId] : [],
                onChange: (keys) => {
                  const k = keys[0];
                  const rec = records.find((r) => (r.id || r._id) === k);
                  if (rec && onSelectionChange) onSelectionChange(rec);
                },
              }
            : undefined
        }
      />
    </Space>
  );
};

export default FormDataQueryTable;
