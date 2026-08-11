import React, { useMemo } from 'react';
import { Button, Tag } from 'antd';
import {
  TagsOutlined,
  CalendarOutlined,
  DownloadOutlined,
  FileTextOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

/**
 * Compact, read-only slot below document title to show metadata.
 */
const DocumentTitleSlot = ({
  doc,
  tags = [],
  tagCategories = [],
  onDownloadOriginal,
  onAddTagClick,
}) => {
  const { t } = useTranslation();

  const resolvedTags = useMemo(() => {
    const filtered = tags.filter((key) => typeof key === 'string' && key.trim() !== '');
    const resolved = filtered.map((key) => {
      const matched = tagCategories.find((cat) => cat.key === key);
      return {
        key,
        name: matched ? matched.label || matched.name : key,
        color: matched?.color || 'default',
      };
    });
    // console.log(
    //   '[DEBUG TitleSlot] tags:', tags,
    //   '\nresolvedTags:', JSON.stringify(resolved, null, 2),
    //   '\ncategories:', JSON.stringify(tagCategories, null, 2)
    // );
    return resolved;
  }, [tags, tagCategories]);

  if (!doc) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '16px',
        width: '100%',
        fontSize: '12px',
        color: 'rgba(0, 0, 0, 0.45)',
        borderBottom: '1px solid #f0f0f0',
        paddingBottom: '8px',
        // marginBottom: '12px',
      }}
    >
      {/* Tags */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <TagsOutlined style={{ fontSize: '13px' }} />
        {resolvedTags.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {resolvedTags.map((tag) => (
              <Tag
                key={tag.key}
                bordered={false}
                style={{
                  margin: 0,
                  fontSize: '11px',
                  lineHeight: '18px',
                  padding: '0 6px',
                  borderRadius: '3px',
                  background: tag.color && tag.color !== 'default' ? undefined : '#f5f5f5',
                }}
                color={tag.color && tag.color !== 'default' ? tag.color : undefined}
              >
                {tag.name}
              </Tag>
            ))}
          </div>
        ) : (
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined style={{ fontSize: '10px' }} />}
            onClick={onAddTagClick}
            style={{
              height: '20px',
              padding: '0 8px',
              fontSize: '11px',
              lineHeight: '18px',
              color: 'rgba(0, 0, 0, 0.45)',
              borderRadius: '3px',
              borderColor: '#d9d9d9',
            }}
          >
            {t('common.addTag', '添加标签')}
          </Button>
        )}
      </div>

      {/* Original File */}
      {doc.originalFileId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FileTextOutlined style={{ fontSize: '13px' }} />
          <Button
            type="link"
            icon={<DownloadOutlined style={{ fontSize: '12px' }} />}
            onClick={onDownloadOriginal}
            size="small"
            style={{
              padding: 0,
              height: 'auto',
              fontSize: '12px',
              color: '#1890ff',
            }}
          >
            {t('documentResourcePanel.downloadOriginal', '下载原始文件')}
          </Button>
        </div>
      )}

      {/* Updated At */}
      {doc.updatedAt && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
          <CalendarOutlined style={{ fontSize: '13px' }} />
          <span>
            {new Date(doc.updatedAt).toLocaleString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      )}
    </div>
  );
};

export default DocumentTitleSlot;
