import React, { useState, useEffect, useRef } from 'react';
import { Select, Tag, Spin, Space, Button, message, Typography, theme, Popconfirm } from 'antd';
import {
  PlusOutlined,
  TagOutlined,
  UserOutlined,
  GlobalOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { getOrgCategories, createOrgCategory, deleteOrgCategory } from '../../api/orgCategories';
import { useTranslation } from 'react-i18next';

const { Option, OptGroup } = Select;
const { Text } = Typography;

const CategorySelect = ({ value, onChange, placeholder, ...props }) => {
  const { t } = useTranslation();
  const actualPlaceholder = placeholder || t('common.selectTags');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [creating, setCreating] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const [popconfirmId, setPopconfirmId] = useState(null);
  const { token } = theme.useToken();

  // Set default mode to multiple if not specified
  const selectMode = props.mode || 'multiple';

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await getOrgCategories();
      // De-duplicate by key if aggregating across multiple orgs (Personal space)
      const uniqueTags = [];
      const keys = new Set();
      data.forEach((tag) => {
        if (!keys.has(tag.key)) {
          keys.add(tag.key);
          uniqueTags.push(tag);
        }
      });
      setCategories(uniqueTags);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreateTag = async (label) => {
    if (!label.trim()) return;
    setCreating(true);
    try {
      const key = label.trim().toLowerCase().replace(/\s+/g, '_');
      const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16);

      const result = await createOrgCategory({
        label: label.trim(),
        key: `${key}_${Math.random().toString(36).substr(2, 4)}`,
        scope: 'user',
        color: randomColor,
      });

      message.success(t('common.tagCreated'));
      await fetchCategories();

      const newCategory = result.data || result;

      // Update the value based on current selection mode
      if (selectMode === 'multiple') {
        const currentValues = Array.isArray(value) ? value : [];
        onChange([...currentValues, newCategory.key]);
      } else {
        onChange(newCategory.key);
      }

      setSearchValue('');
    } catch (error) {
      message.error(error.message || t('common.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTag = async (e, id) => {
    e.stopPropagation();
    try {
      const tag = categories.find((c) => c._id === id);
      if (!tag) return;

      await deleteOrgCategory(id);
      message.success(t('common.tagDeleted'));

      // If the deleted tag was selected, remove it from the value
      if (selectMode === 'multiple') {
        if (Array.isArray(value)) {
          onChange(value.filter((v) => v !== tag.key));
        }
      } else if (value === tag.key) {
        onChange(undefined);
      }

      await fetchCategories();
    } catch (error) {
      message.error(error.message || t('common.deleteFailed'));
    }
  };

  const orgTags = categories.filter((c) => c.scope === 'organization');
  const userTags = categories.filter((c) => c.scope === 'user');

  // Group organizational tags by their source organization
  const orgTagsGrouped = orgTags.reduce((acc, tag) => {
    const orgName = tag.organizationId?.name || t('common.orgStandardTags');
    if (!acc[orgName]) acc[orgName] = [];
    acc[orgName].push(tag);
    return acc;
  }, {});

  // Check if search value exactly matches any existing tag label
  const isSearchExactMatch = categories.some(
    (c) => c.label.toLowerCase() === searchValue.trim().toLowerCase(),
  );

  const handleInternalChange = (val) => {
    onChange?.(val);
    setSearchValue(''); // Clear search on select to keep dropdown open and ready for next
  };

  return (
    <Select
      {...props}
      mode={selectMode}
      showSearch
      loading={loading || creating}
      value={value}
      onChange={handleInternalChange}
      onSearch={setSearchValue}
      searchValue={searchValue}
      placeholder={actualPlaceholder}
      optionLabelProp="label"
      filterOption={(input, option) =>
        (option?.searchLabel ?? '').toLowerCase().includes(input.toLowerCase())
      }
      suffixIcon={loading ? <Spin size="small" /> : <TagOutlined />}
      style={{ width: '100%', ...props.style }}
      allowClear
      autoClearSearchValue={false}
    >
      {searchValue.trim() && !isSearchExactMatch && (
        <Option
          key="create_new_tag_option"
          value={`${searchValue}`}
          label={searchValue}
          searchLabel={searchValue}
        >
          <Popconfirm
            title={t('common.confirmCreateTag', { name: searchValue })}
            onConfirm={() => handleCreateTag(searchValue)}
            okText={t('common.ok')}
            cancelText={t('common.cancel')}
            placement="right"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                color: token.colorPrimary,
                display: 'flex',
                alignItems: 'center',
                padding: '4px 0',
                width: '100%',
              }}
            >
              <PlusOutlined style={{ marginRight: 8 }} />
              <span>{t('common.createAndAddTag')}</span>
              <Text strong style={{ marginLeft: 4, color: token.colorPrimary }}>
                {searchValue}
              </Text>
            </div>
          </Popconfirm>
        </Option>
      )}

      {Object.entries(orgTagsGrouped).map(([orgName, tags]) => (
        <OptGroup
          key={`org-group-${orgName}`}
          label={
            <Space style={{ color: token.colorPrimary, fontSize: '12px' }}>
              <GlobalOutlined />
              <span>{orgName}</span>
            </Space>
          }
        >
          {tags.map((tag) => (
            <Option
              key={tag.key}
              value={tag.key}
              searchLabel={`${tag.label}${tag.key}${orgName}`}
              label={
                <Tag color={tag.color} style={{ margin: 0 }}>
                  {tag.label}
                </Tag>
              }
            >
              <Space>
                <Tag color={tag.color} style={{ margin: 0 }}>
                  {tag.label}
                </Tag>
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  ({tag.key})
                </Text>
              </Space>
            </Option>
          ))}
        </OptGroup>
      ))}

      {userTags.length > 0 && (
        <OptGroup
          label={
            <Space style={{ color: token.colorWarning, fontSize: '12px' }}>
              <UserOutlined />
              <span>{t('common.userPrivateTags')}</span>
            </Space>
          }
        >
          {userTags.map((tag) => (
            <Option
              key={tag.key}
              value={tag.key}
              searchLabel={`${tag.label}${tag.key}${tag.organizationId?.name || ''}`}
              label={
                <Tag color={tag.color} style={{ margin: 0 }}>
                  {tag.label}
                </Tag>
              }
            >
              <div
                onMouseEnter={() => setHoveredId(tag._id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                <Space>
                  <Tag color={tag.color} style={{ margin: 0 }}>
                    {tag.label}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    ({tag.key})
                    {tag.organizationId?.name && (
                      <span style={{ marginLeft: 4 }}>· {tag.organizationId.name}</span>
                    )}
                  </Text>
                </Space>
                <Popconfirm
                  title={t('common.confirmDeleteTag')}
                  onConfirm={(e) => {
                    handleDeleteTag(e, tag._id);
                    setPopconfirmId(null);
                  }}
                  onCancel={(e) => {
                    e.stopPropagation();
                    setPopconfirmId(null);
                  }}
                  onOpenChange={(visible) => {
                    if (visible) setPopconfirmId(tag._id);
                    else setPopconfirmId(null);
                  }}
                  okText={t('common.ok')}
                  cancelText={t('common.cancel')}
                  placement="topRight"
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined style={{ fontSize: '12px' }} />}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      padding: '0 4px',
                      height: '22px',
                      opacity: hoveredId === tag._id || popconfirmId === tag._id ? 1 : 0,
                      transition: 'opacity 0.2s',
                    }}
                  />
                </Popconfirm>
              </div>
            </Option>
          ))}
        </OptGroup>
      )}
    </Select>
  );
};

export default CategorySelect;
