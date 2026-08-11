import React, { useMemo } from 'react';
import { Table, Empty } from 'antd';
import dayjs from 'dayjs';

/**
 * RecordPreviewTable
 * 只读单条记录预览，用表格形式展示字段与值。
 * 使用 formSchema 的字段定义生成列；支持日期、数组、对象格式化。
 */
const RecordPreviewTable = ({ formSchema, record }) => {
  const columns = useMemo(() => {
    if (!formSchema?.fields) return [];
    const fields = formSchema.fields.slice(0, 6); // 与选择弹框保持前6字段一致
    const cols = [];
    // ID 列
    cols.push({
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 140,
      fixed: 'left',
      render: (val, row) =>
        val || row._id ? (
          <span style={{ fontFamily: 'monospace' }}>{val || row._id}</span>
        ) : (
          <span style={{ color: '#999' }}>-</span>
        ),
    });
    // 动态字段列
    fields.forEach((field) => {
      cols.push({
        title: field.properties?.label || field.id,
        dataIndex: field.id,
        key: field.id,
        align: 'left',
        ellipsis: true,
        render: (val) => {
          if (val == null || val === '') return <span style={{ color: '#999' }}>-</span>;
          if (field.type === 'date-picker') {
            const d = dayjs(val);
            return d.isValid() ? d.format('YYYY-MM-DD') : String(val);
          }
          if (Array.isArray(val)) return val.join(', ');
          if (typeof val === 'object') return JSON.stringify(val);
          return String(val);
        },
      });
    });
    // 创建时间列
    cols.push({
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
    });
    return cols;
  }, [formSchema]);

  const dataSource = useMemo(() => {
    if (!record || !columns.length) return [];
    // 保证每条记录都有唯一 key
    return [{ ...record, _key: record.id || record._id || 'preview' }];
  }, [record, columns]);

  if (!record) {
    return <Empty description="未选择数据" />;
  }

  return (
    <Table
      size="small"
      bordered
      pagination={false}
      rowKey="_key"
      dataSource={dataSource}
      columns={columns}
      scroll={{ x: 'max-content' }}
    />
  );
};

export default RecordPreviewTable;
