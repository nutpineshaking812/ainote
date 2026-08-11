import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Input, List, Empty, Space, Typography, Tag, Spin } from 'antd';
import { SearchOutlined, SnippetsOutlined } from '@ant-design/icons';
import useDebounce from '../hooks/useDebounce';
import { listTemplates } from '../api/templates';

const { Text } = Typography;

const normalizeTemplates = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
};

const getPreviewLines = (blocks) => {
  if (!Array.isArray(blocks)) return [];
  const lines = [];
  for (const block of blocks) {
    if (!block || block.type === 'title') continue;
    const content = Array.isArray(block.content)
      ? block.content
          .map((frag) => frag?.text || '')
          .join('')
          .trim()
      : '';
    if (content) {
      lines.push(content);
    }
    if (lines.length >= 2) break;
  }
  return lines;
};

export default function TemplateSelectorModal({ visible, onCancel, onSelect, appId, type }) {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounce(keyword, 200);

  useEffect(() => {
    if (!visible) return;
    let ignore = false;

    const loadTemplates = async () => {
      setLoading(true);
      try {
        const data = await listTemplates({ appId, type });
        if (!ignore) {
          setTemplates(normalizeTemplates(data));
        }
      } catch (err) {
        console.warn('Failed to load templates for selector', err);
        if (!ignore) setTemplates([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadTemplates();
    return () => {
      ignore = true;
    };
  }, [visible, appId]);

  const filteredTemplates = useMemo(() => {
    const kw = debouncedKeyword.trim().toLowerCase();
    if (!kw) return templates;
    return templates.filter((tpl) => {
      const haystack = `${tpl?.name || ''} ${tpl?.description || ''}`.toLowerCase();
      return haystack.includes(kw);
    });
  }, [templates, debouncedKeyword]);

  const renderItem = (tpl) => {
    const previewLines = getPreviewLines(tpl?.blocks);
    const scopeLabel = tpl?.scope === 'app' ? '应用模板' : '个人模板';
    const scopeColor = tpl?.scope === 'app' ? 'orange' : 'default';

    return (
      <List.Item
        key={tpl?._id || tpl?.id}
        onClick={() => onSelect?.(tpl)}
        style={{
          cursor: 'pointer',
          borderRadius: 12,
          padding: '12px 16px',
          transition: 'background 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#fafafa';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <Space align="start" size={12} style={{ width: '100%' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#f6ffed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#52c41a',
              flexShrink: 0,
            }}
          >
            <SnippetsOutlined />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Space size={8} align="center" style={{ marginBottom: 4 }}>
              <Text strong ellipsis style={{ maxWidth: 260 }}>
                {tpl?.name || '未命名模板'}
              </Text>
              <Tag color={scopeColor} style={{ marginInlineEnd: 0 }}>
                {scopeLabel}
              </Tag>
            </Space>
            {tpl?.description && (
              <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                {tpl.description}
              </Text>
            )}
            {previewLines.length > 0 ? (
              <div style={{ color: '#999', fontSize: 12 }}>
                {previewLines.map((line, idx) => (
                  <div
                    key={idx}
                    style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>
                暂无预览内容
              </Text>
            )}
          </div>
        </Space>
      </List.Item>
    );
  };

  return (
    <Modal
      open={visible}
      title="选择参考格式"
      onCancel={onCancel}
      footer={null}
      width={640}
      destroyOnClose
      zIndex={10000}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <Input
          placeholder="搜索模板名称或描述..."
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          allowClear
        />

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <Empty description={keyword ? '没有匹配的模板' : '暂无可用模板'} />
        ) : (
          <div style={{ maxHeight: 420, overflow: 'auto' }}>
            <List dataSource={filteredTemplates} renderItem={renderItem} split={false} />
          </div>
        )}
      </Space>
    </Modal>
  );
}
