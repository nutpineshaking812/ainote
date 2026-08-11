/**
 * AIPromptManager
 *
 * A dual-mode component for managing AI prompts:
 * 1. Overview Mode: Shows recent usage, personal library, and app-scoped prompts.
 * 2. ListView Mode: Provides full-page filtered results and search with pagination.
 *
 * Features:
 * - Balanced dashboard loading (6 personal / 3 app prompts) via dedicated backend endpoint.
 * - Shared App Library: App-scoped prompts are shared among all authorized users of the app.
 * - Integrated Editor: Uses DocumentEditorModal for rich-text prompt engineering.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Drawer,
  Button,
  Input,
  Space,
  Tooltip,
  Typography,
  Popconfirm,
  message,
  Empty,
  Card,
  Spin,
  Dropdown,
  Tag,
  Pagination,
  Checkbox,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  listPrompts,
  getPromptDashboard,
  getPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
} from '../api/prompts';
import DocumentEditorModal from './DocumentEditorModal'; // Shared component

const RECENT_USAGE_KEY = 'ai_prompt_manager_recent_usage';
const { Search } = Input;
const { Text } = Typography;

const AIPromptManager = ({
  open,
  onClose,
  appId,
  onSelect,
  width = 720,
  defaultOnlyApp = false,
  forcedView = null, // 'recent' | 'personal' | 'app' | 'search'
}) => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [keyword, setKeyword] = useState('');

  // Editor State
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorSeed, setEditorSeed] = useState(0);
  const [templateInitialBlocks, setTemplateInitialBlocks] = useState([]);
  const [templateBlocks, setTemplateBlocks] = useState([]);
  const [templateInitialTitle, setTemplateInitialTitle] = useState('');
  const [templateTitle, setTemplateTitle] = useState('');
  const [formState, setFormState] = useState({
    id: null,
    scope: appId ? 'app' : 'personal',
    appId: appId || null,
  });
  const [submitting, setSubmitting] = useState(false);

  // UI & View State
  const [recentUsage, setRecentUsage] = useState({});
  const [fullViewType, setFullViewType] = useState(forcedView); // 'recent' | 'personal' | 'app' | 'search'
  const [onlyApp, setOnlyApp] = useState(defaultOnlyApp); // Toggle to filter by current app only
  const [dashboardTotals, setDashboardTotals] = useState({ personal: 0, app: 0 }); // Server-reported totals for dashboard sections

  // --- Data Fetching Logic ---

  const fetchTemplates = useCallback(async () => {
    if (!open || fullViewType) return;
    setLoading(true);
    try {
      if (onlyApp) {
        // Balanced dashboard not needed when filtered to app-only
        const data = await listPrompts(appId, {
          scope: 'app',
          limit: 12,
          fields: 'name description contentPlain scope updatedAt appId',
        });
        setTemplates(Array.isArray(data) ? data : data.items || []);
        setDashboardTotals({ personal: 0, app: data.pagination?.total || 0 });
      } else {
        const data = await getPromptDashboard(appId);
        const combined = [...(data.personal?.items || []), ...(data.app?.items || [])];
        setTemplates(combined);
        setDashboardTotals({
          personal: data.personal?.total || 0,
          app: data.app?.total || 0,
        });
      }
    } catch (error) {
      console.error(error);
      message.error('加载提示语失败');
    } finally {
      setLoading(false);
    }
  }, [open, appId, onlyApp]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (open) {
      // Re-initialize from props when opening
      setOnlyApp(defaultOnlyApp);
      setFullViewType(forcedView);
    } else {
      // Reset when closing
      setKeyword('');
    }
  }, [open, defaultOnlyApp, forcedView]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_USAGE_KEY);
      if (stored) setRecentUsage(JSON.parse(stored));
    } catch (err) {}
  }, []);

  const openCreateModal = () => {
    setFormState({ id: null, scope: 'personal', appId: appId || null });
    setTemplateInitialTitle('');
    setTemplateTitle('');
    setTemplateInitialBlocks([]);
    setTemplateBlocks([]);
    setEditorSeed((s) => s + 1);
    setEditorVisible(true);
  };

  const openEditModal = async (tpl) => {
    let fullTpl = tpl;
    if (!fullTpl.blocks) {
      setLoading(true);
      try {
        fullTpl = await getPrompt(tpl.appId || appId, tpl._id);
      } catch (e) {
        message.error('获取详情失败');
        return;
      } finally {
        setLoading(false);
      }
    }
    setFormState({ id: fullTpl._id, scope: fullTpl.scope, appId: fullTpl.appId || appId || null });
    setTemplateInitialTitle(fullTpl.name || '');
    setTemplateTitle(fullTpl.name || '');
    setTemplateInitialBlocks(fullTpl.blocks || []);
    setTemplateBlocks(fullTpl.blocks || []);
    setEditorSeed((s) => s + 1);
    setEditorVisible(true);
  };

  const handleDelete = async (tpl) => {
    try {
      await deletePrompt(tpl.appId || appId, tpl._id);
      message.success('已删除');
      fetchTemplates();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSelect = useCallback(
    async (tpl) => {
      if (!onSelect) return;
      let fullTpl = tpl;
      if (!fullTpl.blocks) {
        setLoading(true);
        try {
          fullTpl = await getPrompt(tpl.appId || appId, tpl._id);
        } catch (e) {
          message.error('获取详情失败');
          return;
        } finally {
          setLoading(false);
        }
      }

      setRecentUsage((prev) => {
        const next = { ...prev, [fullTpl._id]: Date.now() };
        localStorage.setItem(RECENT_USAGE_KEY, JSON.stringify(next));
        return next;
      });

      // Convert blocks to Markdown
      const blocksToMarkdown = (blocks) => {
        if (!blocks || !Array.isArray(blocks)) return '';
        return blocks
          .map((block) => {
            if (!block) return '';

            const contentText = Array.isArray(block.content)
              ? block.content.map((c) => c.text || '').join('')
              : '';

            switch (block.type) {
              case 'heading':
                // Map level 1-3 to #
                const level = block.props?.level || 1;
                return `${'#'.repeat(level)} ${contentText}`;
              case 'bulletListItem':
                return `- ${contentText}`;
              case 'numberedListItem':
                return `1. ${contentText}`; // Simplify to 1. for now, markdown renders it correctly
              case 'checkListItem':
                return `- [ ] ${contentText}`;
              case 'paragraph':
              default:
                return contentText;
            }
          })
          .join('\n\n'); // Double newline for paragraph separation
      };

      const textContent = blocksToMarkdown(fullTpl.blocks);

      onSelect({ ...fullTpl, textContent });
      onClose();
    },
    [onSelect, onClose, appId],
  );

  const handleSubmitTemplate = async () => {
    const trimmedTitle = templateTitle.trim();
    if (!trimmedTitle || !templateBlocks?.length) {
      message.warning('请输入标题和内容');
      return;
    }
    const payload = {
      name: trimmedTitle,
      description: '',
      scope: formState.scope,
      blocks: templateBlocks,
      appId: formState.scope === 'app' ? appId || formState.appId : undefined,
    };
    setSubmitting(true);
    try {
      if (formState.id) {
        await updatePrompt(formState.appId || appId, { id: formState.id, ...payload });
        message.success('已更新');
      } else {
        await createPrompt(formState.appId || appId, payload);
        message.success('已创建');
      }
      setEditorVisible(false);
      fetchTemplates();
    } catch (error) {
      message.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearch = (val) => {
    setKeyword(val);
    if (val && !fullViewType) {
      setFullViewType('search');
    } else if (!val && fullViewType === 'search') {
      setFullViewType(forcedView || null);
    }
  };

  // Map internal view types to display names
  const titleMap = {
    recent: '最近使用',
    personal: '个人提示语库',
    app: '应用提示语库',
    search: '搜索结果',
  };

  return (
    <>
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Text strong>{fullViewType ? titleMap[fullViewType] : 'AI 提示语库'}</Text>
            {!fullViewType && (
              <Button icon={<ReloadOutlined />} type="text" onClick={fetchTemplates} />
            )}
          </div>
        }
        placement="right"
        size={width}
        onClose={onClose}
        open={open}
        zIndex={1100}
        destroyOnClose
        extra={
          <Space>
            <Checkbox
              checked={onlyApp}
              onChange={(e) => setOnlyApp(e.target.checked)}
              style={{ fontSize: 13 }}
            >
              仅显示本应用
            </Checkbox>
            <Search
              placeholder="搜索库内提示语..."
              allowClear
              value={keyword}
              onSearch={handleSearch}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ width: 160 }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新建
            </Button>
          </Space>
        }
      >
        {loading && !fullViewType ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : (
          <div style={{ paddingBottom: 40 }}>
            {fullViewType ? (
              <PromptListView
                type={fullViewType}
                appId={appId}
                initialSearch={keyword}
                onlyApp={onlyApp}
                isForced={!!forcedView}
                onBack={() => setFullViewType(null)}
                onSearchChange={setKeyword}
                onSelect={handleSelect}
                onEdit={openEditModal}
                onDelete={handleDelete}
              />
            ) : (
              <PromptOverview
                templates={templates}
                recentUsage={recentUsage}
                onlyApp={onlyApp}
                appId={appId}
                totals={dashboardTotals}
                onSelect={handleSelect}
                onEdit={openEditModal}
                onDelete={handleDelete}
                onViewAll={setFullViewType}
                openCreateModal={openCreateModal}
              />
            )}
          </div>
        )}
      </Drawer>

      <DocumentEditorModal
        open={editorVisible}
        title={formState.id ? '编辑提示语' : '新建提示语'}
        onClose={() => setEditorVisible(false)}
        editorKey={`prompt-editor-${editorSeed}`}
        editorProps={{
          initialTitle: templateInitialTitle,
          title: templateTitle,
          initialBlocks: templateInitialBlocks,
          onChange: setTemplateBlocks,
          onTitleChange: setTemplateTitle,
          withTitle: true,
          height: 400,
          showAIUI: false,
          placeholderTitle: '给提示语起个名字...',
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Dropdown.Button
              type="primary"
              loading={submitting}
              onClick={handleSubmitTemplate}
              menu={{
                items: [
                  { key: 'personal', label: '个人库' },
                  { key: 'app', label: '应用库', disabled: !appId && !formState.appId },
                ],
                onClick: ({ key }) =>
                  setFormState((p) => ({
                    ...p,
                    scope: key,
                    appId: key === 'app' ? appId || p.appId : null,
                  })),
              }}
            >
              {formState.id
                ? '保存修改'
                : `创建${formState.scope === 'app' ? '应用' : '个人'}提示语`}
            </Dropdown.Button>
          </div>
        }
      />
    </>
  );
};

// --- Specialized Rendering Sub-Components ---

/**
 * PromptCard - Individual prompt item renderer with actions.
 */
const PromptCard = ({ tpl, sectionId, onSelect, onEdit, onDelete }) => {
  const [hovered, setHovered] = useState(false);
  const isApp = tpl.scope === 'app';
  const itemId = `${sectionId}-${tpl._id}`;

  return (
    <Card
      hoverable
      onClick={() => onSelect(tpl)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ borderRadius: 12, border: '1px solid #f0f0f0', transition: 'all 0.2s ease' }}
      styles={{
        body: { padding: '12px', display: 'flex', flexDirection: 'column', height: '100%' },
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 8,
        }}
      >
        <Tag color={isApp ? 'orange' : 'blue'} style={{ margin: 0, fontSize: 10, borderRadius: 4 }}>
          {isApp ? '应用' : '个人'}
        </Tag>
        <div
          style={{ display: 'flex', gap: 4, opacity: hovered ? 1 : 0, transition: 'opacity 0.2s' }}
        >
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ fontSize: 12 }} />}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(tpl);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="删除提示语?"
            onConfirm={(e) => {
              e.stopPropagation();
              onDelete(tpl);
            }}
            okText="删除"
            cancelText="取消"
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined style={{ fontSize: 12 }} />}
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        </div>
      </div>
      <div style={{ marginBottom: 4 }}>
        <Text strong style={{ fontSize: 14 }} ellipsis={{ tooltip: tpl.name }}>
          {tpl.name}
        </Text>
      </div>
      <div
        style={{
          color: '#8c8c8c',
          fontSize: 12,
          lineHeight: '1.5',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: 8,
        }}
      >
        {tpl.contentPlain || '暂无内容'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {new Date(tpl.updatedAt).toLocaleDateString()}
        </Text>
      </div>
    </Card>
  );
};

/**
 * PromptOverview - The default dashboard view of the manager.
 */
const PromptOverview = ({
  templates,
  recentUsage,
  onlyApp,
  appId,
  totals,
  onSelect,
  onEdit,
  onDelete,
  onViewAll,
  openCreateModal,
}) => {
  const recentTemplates = useMemo(() => {
    const sorted = templates
      .slice()
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    const usageEntries = Object.entries(recentUsage || {}).sort(([, a], [, b]) => b - a);
    if (!usageEntries.length) return sorted.slice(0, 3);
    const map = new Map(sorted.map((t) => [t._id, t]));
    return usageEntries
      .map(([id]) => map.get(id))
      .filter(Boolean)
      .slice(0, 6);
  }, [recentUsage, templates]);

  const personalTemplates = useMemo(
    () => templates.filter((t) => t.scope === 'personal'),
    [templates],
  );
  const appTemplates = useMemo(() => templates.filter((t) => t.scope === 'app'), [templates]);

  const renderSection = (title, type, list, serverTotal) => {
    if (!list.length) return null;
    // If onlyApp is active, show more (up to the fetch limit 12) for the app section
    const defaultSize = type === 'app' ? 3 : 6;
    const PAGE_SIZE = type === 'app' && onlyApp ? 12 : defaultSize;
    const displayedList = list.slice(0, PAGE_SIZE);
    const hasMore = serverTotal > PAGE_SIZE;

    return (
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Typography.Title
            level={5}
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{ width: 4, height: 16, background: '#1890ff', borderRadius: 2 }} />
            {title}
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              ({list.length})
            </Text>
          </Typography.Title>
          {hasMore && (
            <Button type="link" size="small" onClick={() => onViewAll(type)}>
              查看全部
            </Button>
          )}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          {displayedList.map((t) => (
            <PromptCard
              key={t._id}
              tpl={t}
              sectionId={title}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>
    );
  };

  if (!templates.length)
    return (
      <Empty description="暂无提示语">
        <Button type="primary" onClick={openCreateModal}>
          新建第一个提示语
        </Button>
      </Empty>
    );

  return (
    <>
      {renderSection(
        '最近使用',
        'recent',
        onlyApp
          ? recentTemplates.filter((t) => t.scope === 'app' || t.appId === appId)
          : recentTemplates,
        recentTemplates.length,
      )}
      {!onlyApp && renderSection('个人库', 'personal', personalTemplates, totals.personal)}
      {renderSection('应用库', 'app', appTemplates, totals.app)}
    </>
  );
};

/**
 * PromptListView - Full-page view with pagination and server-side filtering.
 */
const PromptListView = ({
  type,
  appId,
  initialSearch,
  onlyApp,
  isForced,
  onBack,
  onSearchChange,
  onSelect,
  onEdit,
  onDelete,
}) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ items: [], total: 0 });

  const fetchDetail = useCallback(async () => {
    if (!type) return;
    setLoading(true);
    try {
      const targetAppId = onlyApp || type === 'app' || type === 'search' ? appId : null;
      const params = {
        page,
        limit: pageSize,
        keyword: initialSearch,
        fields: 'name description contentPlain scope updatedAt appId',
      };
      if (type === 'personal') params.scope = 'personal';
      else if (type === 'app' || onlyApp) params.scope = 'app';

      const res = await listPrompts(targetAppId, params);
      if (res && res.items) setData({ items: res.items, total: res.pagination.total });
      else if (Array.isArray(res)) setData({ items: res, total: res.length });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [type, appId, page, initialSearch, pageSize, onlyApp]);

  useEffect(() => {
    setPage(1);
  }, [type, initialSearch]);
  useEffect(() => {
    if (type) fetchDetail();
  }, [page, fetchDetail, type]);

  return (
    <div style={{ paddingBottom: 24 }}>
      {!isForced && (
        <Button
          type="link"
          onClick={onBack}
          style={{
            padding: '0 0 16px 0',
            height: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          ← 返回概览
        </Button>
      )}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 64 }}>
          <Spin />
        </div>
      ) : (
        <>
          {!data.items.length ? (
            <Empty description="未找到匹配的提示语" style={{ marginTop: 64 }} />
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                {data.items.map((t) => (
                  <PromptCard
                    key={t._id}
                    tpl={t}
                    sectionId={`full-${type}`}
                    onSelect={onSelect}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </div>
              <Pagination
                current={page}
                total={data.total}
                pageSize={pageSize}
                align="center"
                onChange={(p, s) => {
                  setPage(p);
                  if (s !== pageSize) {
                    setPageSize(s);
                    setPage(1);
                  }
                }}
                showSizeChanger
                pageSizeOptions={['12', '15', '18', '21']}
                size="small"
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default AIPromptManager;
