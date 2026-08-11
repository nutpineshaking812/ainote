import dayjs from 'dayjs';
import { Image, Tooltip, Dropdown, Space, Typography, Select } from 'antd';
import {
  HolderOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  FilterOutlined,
  GroupOutlined,
} from '@ant-design/icons';
import React from 'react';
import { humanSize } from './sizeUtils';

// Build dynamic columns (without operation and createdAt) given fieldDefs & visibility & widths
export function buildDynamicColumns(
  fieldDefs,
  visibleFieldIds,
  columnWidths,
  headerMenuHandlers,
  frozenFieldIds = [],
) {
  const { onSortAsc, onSortDesc, onFreeze, onHide, onGroup, onQuickFilterChange } =
    headerMenuHandlers || {};
  const filtered = fieldDefs.filter(
    (field) => !visibleFieldIds || visibleFieldIds.includes(field.id),
  );
  // Reorder: frozen fields first, keep original relative order
  const ordered = [
    ...filtered.filter((f) => frozenFieldIds.includes(f.id)),
    ...filtered.filter((f) => !frozenFieldIds.includes(f.id)),
  ];

  return ordered.map((field) => ({
    title: () => {
      const isFrozen = frozenFieldIds.includes(field.id);
      const menuItems = [
        {
          key: 'asc',
          label: '升序',
          icon: <ArrowUpOutlined />,
          onClick: () => onSortAsc && onSortAsc(field),
        },
        {
          key: 'desc',
          label: '降序',
          icon: <ArrowDownOutlined />,
          onClick: () => onSortDesc && onSortDesc(field),
        },
        { type: 'divider' },
        {
          key: 'freeze',
          label: isFrozen ? '取消冻结' : '冻结列',
          icon: <LockOutlined />,
          onClick: () => onFreeze && onFreeze(field),
        },
        {
          key: 'hide',
          label: '隐藏此列',
          icon: <EyeInvisibleOutlined />,
          onClick: () => onHide && onHide(field),
        },
        // { key: 'group', label: '按此字段分组', icon: <GroupOutlined />, onClick: () => onGroup && onGroup(field) },
        // { type: 'divider' }
      ];
      const filterSelect = (
        <Select
          size="small"
          mode={
            field.type === 'checkbox-group' || field.type === 'dropdown-checkbox'
              ? 'multiple'
              : undefined
          }
          placeholder="筛选值"
          style={{ minWidth: 160 }}
          allowClear
          onChange={(val) => onQuickFilterChange && onQuickFilterChange(field, val)}
          options={(field.properties?.options || []).map((o) => ({
            label: o.label,
            value: o.value,
          }))}
        />
      );
      const fullMenu = [
        ...menuItems,
        // { key: 'filter-label', disabled: true, label: <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FilterOutlined /> <span style={{ color: '#08979c' }}>筛选 等于任意一个</span></div> },
        // { key: 'filter-control', label: filterSelect }
      ];
      return (
        <Dropdown
          trigger={['click']}
          menu={{
            items: fullMenu.map((i) =>
              i.type === 'divider'
                ? { type: 'divider' }
                : {
                    key: i.key,
                    label: i.label,
                    icon: i.icon,
                    disabled: i.disabled,
                    onClick: i.onClick,
                  },
            ),
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 4,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <Typography.Text style={{ flex: 1, minWidth: 0, fontWeight: 500 }}>
              {field.properties.label}
            </Typography.Text>
            <HolderOutlined style={{ fontSize: 12, color: '#999', flexShrink: 0 }} />
          </div>
        </Dropdown>
      );
    },
    dataIndex: field.id,
    key: field.id,
    sorter: false,
    editable:
      !['image', 'attachment', 'matrix-scale', 'ranking'].includes(field.type) &&
      !field.properties?.readOnly &&
      !field.readOnly,
    width:
      columnWidths[field.id] ||
      (field.type === 'image' ? 240 : field.type === 'attachment' ? 260 : 160),
    ellipsis: field.type === 'attachment',
    fixed: frozenFieldIds.includes(field.id) ? 'left' : undefined,
    render: (value) => {
      if (field.type === 'date-picker' && value) {
        const d = dayjs(value);
        return d.isValid() ? d.format('YYYY-MM-DD') : value;
      }
      if (field.type === 'radio-group') {
        if (value === undefined || value === null || value === '') return null;
        const opts = field.properties?.options || [];
        const found = opts.find((o) => o.value === value);
        return found ? found.label : String(value);
      }
      if (field.type === 'checkbox-group') {
        if (!Array.isArray(value) || !value.length) return null;
        const opts = field.properties?.options || [];
        const labels = value.map((v) => opts.find((o) => o.value === v)?.label || String(v));
        const text = labels.join(', ');
        return (
          <Tooltip title={text}>
            <span>{text}</span>
          </Tooltip>
        );
      }
      if (field.type === 'dropdown') {
        if (value === undefined || value === null || value === '') return null;
        const opts = field.properties?.options || [];
        const found = opts.find((o) => o.value === value);
        return found ? found.label : String(value);
      }
      if (field.type === 'dropdown-checkbox') {
        const arr = Array.isArray(value) ? value : value ? [value] : [];
        if (!arr.length) return null;
        const opts = field.properties?.options || [];
        const labels = arr.map((v) => opts.find((o) => o.value === v)?.label || String(v));
        const text = labels.join(', ');
        return (
          <Tooltip title={text}>
            <span>{text}</span>
          </Tooltip>
        );
      }
      if (field.type === 'image') {
        const list = Array.isArray(value) ? value : value ? [value] : [];
        const normalized = list
          .map((item, idx) => {
            if (!item) return null;
            if (typeof item === 'string')
              return { url: item, name: item.split('/').pop() || `图片-${idx + 1}` };
            return { url: item.url, name: item.name || item.fileName || `图片-${idx + 1}` };
          })
          .filter((f) => f && f.url);
        if (!normalized.length) return null;
        return (
          <Image.PreviewGroup>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 220 }}>
              {normalized.map((f, i) => (
                <Tooltip title={f.name} key={i}>
                  <Image
                    src={f.url}
                    alt={f.name}
                    width={42}
                    height={42}
                    style={{ objectFit: 'cover', borderRadius: 4 }}
                  />
                </Tooltip>
              ))}
            </div>
          </Image.PreviewGroup>
        );
      }
      if (field.type === 'attachment') {
        const list = Array.isArray(value) ? value : value ? [value] : [];
        const normalized = list
          .map((item, idx) => {
            if (!item) return null;
            if (typeof item === 'string')
              return { url: item, name: item.split('/').pop() || `附件-${idx + 1}` };
            return {
              url: item.url,
              name: item.name || item.originalName || item.fileName || `附件-${idx + 1}`,
              size: item.size,
            };
          })
          .filter((f) => f && f.url);
        if (!normalized.length) return null;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 240 }}>
            {normalized.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Tooltip title={f.name}>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      maxWidth: 200,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {f.name}
                  </a>
                </Tooltip>
                {f.size && <span style={{ fontSize: 11, color: '#999' }}>{humanSize(f.size)}</span>}
              </div>
            ))}
          </div>
        );
      }
      if (field.type === 'ranking') {
        if (!Array.isArray(value) || !value.length) return null;
        const opts = field.properties?.options || [];
        const labels = value.map((v) => opts.find((o) => o.value === v)?.label || String(v));
        const fullText = labels.map((label, index) => `${index + 1}. ${label}`).join('\n');
        const displayText = labels.slice(0, 3).map((label, index) => `${index + 1}. ${label}`).join('\n') + (labels.length > 3 ? '\n...' : '');

        return (
          <Tooltip
            title={
              <div>
                {fullText.split('\n').map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </div>
            }
          >
            <div style={{ whiteSpace: 'pre-wrap' }}>{displayText}</div>
          </Tooltip>
        );
      }
      if (field.type === 'matrix-scale') {
        if (typeof value !== 'object' || value === null) return null;
        const rows = field.properties?.rows || [];
        const columns = field.properties?.columns || [];
        const pairs = Object.entries(value).map(([rowValue, colValue]) => {
          // Only attempt to find labels if properties.rows/columns are available
          const rowLabel = field.properties?.rows ? rows.find((r) => r.value === rowValue)?.label || rowValue : rowValue;
          const colLabel = field.properties?.columns ? columns.find((c) => c.value === colValue)?.label || colValue : colValue;
          return `${rowLabel}: ${colLabel}`;
        });
        const fullText = pairs.join('\n');
        const displayText = pairs.slice(0, 3).join('\n') + (pairs.length > 3 ? '\n...' : '');

        return (
          <Tooltip
            title={
              <div>
                {fullText.split('\n').map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </div>
            }
          >
            <div style={{ whiteSpace: 'pre-wrap' }}>{displayText}</div>
          </Tooltip>
        );
      }
      if (Array.isArray(value)) return value.join(', ');
      return value;
    },
  }));
}
