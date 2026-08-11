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
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../../../api/templates';
import DocumentEditorModal from '../../../components/DocumentEditorModal';

const RECENT_USAGE_KEY = 'document_template_recent_usage';

const { Search } = Input;
const { Text } = Typography;

const TemplateCenterDrawer = ({
  open,
  onClose,
  appId,
  onApplyTemplate,
  onCreateDocument,
  type,
}) => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [keyword, setKeyword] = useState('');
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
  const [recentUsage, setRecentUsage] = useState({});
  const [hoveredCardId, setHoveredCardId] = useState(null);
  const [actionLockedId, setActionLockedId] = useState(null);

  const resolvedType = type ?? 'document';

  const handleLoad = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await listTemplates({ appId, type: resolvedType });
      if (res && res.items) {
        setTemplates(res.items);
      } else {
        setTemplates(Array.isArray(res) ? res : []);
      }
    } catch (error) {
      console.error(error);
      message.error('加载模板失败');
    } finally {
      setLoading(false);
    }
  }, [open, appId]);

  useEffect(() => {
    handleLoad();
  }, [handleLoad]);

  useEffect(() => {
    if (!open) {
      setKeyword('');
    }
  }, [open]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_USAGE_KEY);
      if (stored) {
        setRecentUsage(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to load recent template usage', err);
    }
  }, []);

  const filteredTemplates = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return templates.filter((tpl) => {
      const keywordOk = kw
        ? (tpl.name || '').toLowerCase().includes(kw) ||
          (tpl.description || '').toLowerCase().includes(kw)
        : true;
      return keywordOk;
    });
  }, [templates, keyword]);

  useEffect(() => {
    if (!templates.length) return;
    setRecentUsage((prev) => {
      const validIds = new Set(templates.map((tpl) => tpl._id));
      let mutated = false;
      const next = Object.keys(prev).reduce((acc, id) => {
        if (validIds.has(id)) {
          acc[id] = prev[id];
        } else {
          mutated = true;
        }
        return acc;
      }, {});
      if (mutated) {
        try {
          localStorage.setItem(RECENT_USAGE_KEY, JSON.stringify(next));
        } catch (err) {
          console.error('Failed to persist recent usage', err);
        }
        return next;
      }
      return prev;
    });
  }, [templates]);

  const openCreateModal = useCallback(
    (scopeOverride) => {
      const resolvedScope = 'personal';
      const resolvedAppId = resolvedScope === 'app' ? appId || formState.appId || null : null;
      setFormState({ id: null, scope: resolvedScope, appId: resolvedAppId });
      setTemplateInitialTitle('');
      setTemplateTitle('');
      setTemplateInitialBlocks([]);
      setTemplateBlocks([]);
      setEditorSeed((prev) => prev + 1);
      setEditorVisible(true);
    },
    [appId, formState.appId],
  );

  const openEditModal = (tpl) => {
    setFormState({
      id: tpl._id,
      scope: tpl.scope,
      appId: tpl.appId || appId || null,
    });
    const title = tpl.name || '';
    setTemplateInitialTitle(title);
    setTemplateTitle(title);
    const initialBlocks = Array.isArray(tpl.blocks) ? tpl.blocks : [];
    setTemplateInitialBlocks(initialBlocks);
    setTemplateBlocks(initialBlocks);
    setEditorSeed((prev) => prev + 1);
    setEditorVisible(true);
  };

  const closeEditor = useCallback(() => {
    setEditorVisible(false);
  }, []);

  const handleScopeChange = useCallback(
    (nextScope) => {
      setFormState((prev) => ({
        ...prev,
        scope: nextScope,
        appId: nextScope === 'app' ? appId || prev.appId : null,
      }));
    },
    [appId],
  );

  const handleCreateDocumentCard = useCallback(async () => {
    if (onCreateDocument) {
      try {
        await Promise.resolve(onCreateDocument());
      } catch (err) {
        console.error('Create document from template center failed', err);
      } finally {
        onClose?.();
      }
    } else {
      openCreateModal();
    }
  }, [onCreateDocument, onClose, openCreateModal]);

  const handleBlocksChange = useCallback((blocks) => {
    setTemplateBlocks(blocks || []);
  }, []);

  const handleTitleChange = useCallback((value) => {
    setTemplateTitle(value || '');
  }, []);

  const handleSubmitTemplate = async () => {
    const trimmedTitle = templateTitle.trim();
    if (!trimmedTitle) {
      message.warning('请输入模板标题');
      return;
    }
    if (!templateBlocks || templateBlocks.length === 0) {
      message.warning('请先编写模板内容');
      return;
    }
    const payload = {
      name: trimmedTitle,
      description: '',
      scope: formState.scope,
      type: type ?? 'document',
      blocks: templateBlocks.map((blk) => {
        // blk.props.frozen = true;
        return blk;
      }), // 深拷贝避免引用问题
    };
    if (payload.scope === 'app') {
      const resolvedAppId = appId || formState.appId;
      if (!resolvedAppId) {
        message.warning('缺少 appId，无法保存应用模板');
        return;
      }
      payload.appId = resolvedAppId;
    } else {
      payload.appId = undefined;
    }

    setSubmitting(true);
    try {
      if (formState.id) {
        await updateTemplate({ id: formState.id, ...payload });
        message.success('模板已更新');
      } else {
        await createTemplate(payload);
        message.success('模板已创建');
      }
      // closeEditor();
      handleLoad();
    } catch (error) {
      console.error(error);
      message.error(formState.id ? '更新模板失败' : '创建模板失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tpl) => {
    try {
      await deleteTemplate(tpl._id);
      message.success('模板已删除');
      handleLoad();
    } catch (error) {
      console.error(error);
      message.error('删除模板失败');
    }
  };

  const getPreviewLines = useCallback((blocks) => {
    if (!Array.isArray(blocks)) return [];
    const lines = [];
    for (const block of blocks) {
      if (!block || block.type === 'title') continue;
      const content = Array.isArray(block.content)
        ? block.content
            .map((frag) => {
              if (frag) {
                return frag.text || '';
              }
              return '';
            })
            .join('')
            .trim()
        : '';
      if (content) {
        lines.push(content);
      }
      if (lines.length >= 3) break;
    }
    return lines;
  }, []);

  const handleApplyTemplate = useCallback(
    (tpl) => {
      if (!tpl?._id) return;
      setRecentUsage((prev) => {
        const next = { ...prev, [tpl._id]: Date.now() };
        try {
          localStorage.setItem(RECENT_USAGE_KEY, JSON.stringify(next));
        } catch (err) {
          console.error('Failed to persist template usage', err);
        }
        return next;
      });
      onApplyTemplate?.(tpl);
    },
    [onApplyTemplate],
  );

  const renderTemplateCard = (tpl, canEdit = true, sectionId) => {
    const previewLines = getPreviewLines(tpl.blocks);
    const scopeLabel = tpl.scope === 'app' ? '应用' : '个人';
    const scopeBadgeStyles = {
      position: 'absolute',
      top: 0,
      left: 0,
      padding: '2px 10px',
      borderTopLeftRadius: 10,
      borderBottomRightRadius: 10,
      background: tpl.scope === 'app' ? '#faad14' : '#d9d9d9',
      color: tpl.scope === 'app' ? '#613400' : '#595959',
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: 1,
      boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
    };
    const itemId = sectionId + '-' + tpl._id;
    return (
      <Card
        key={tpl._id}
        hoverable
        style={{
          width: '100%',
          minHeight: 180,
          borderRadius: 16,
          position: 'relative',
          height: '100%',
        }}
        styles={{
          body: {
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            height: '100%',
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: 6,
            paddingBottom: 6,
          },
        }}
        onClick={() => {
          if (actionLockedId === tpl._id) return;
          handleApplyTemplate(tpl);
        }}
        onMouseEnter={() => onApplyTemplate && setHoveredCardId(itemId)}
        onMouseLeave={() => onApplyTemplate && setHoveredCardId(null)}
      >
        <div style={scopeBadgeStyles}>{scopeLabel}</div>
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            display: canEdit ? 'flex' : 'none',
            justifyContent: 'center',
            gap: 8,
            padding: '4px 6px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.9)',
            boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
            opacity: hoveredCardId === itemId ? 1 : 0,
            pointerEvents: hoveredCardId === itemId ? 'auto' : 'none',
            transition: 'opacity 0.2s ease',
          }}
        >
          <Tooltip title="编辑模板">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(tpl);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除该模板吗?"
            okText="删除"
            okType="danger"
            cancelText="取消"
            onConfirm={(e) => {
              e.stopPropagation();
              handleDelete(tpl);
            }}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        </div>
        <div style={{ marginTop: 24 }}>
          <Text strong style={{ fontSize: 16 }}>
            {tpl.name || '未命名模板'}
          </Text>
        </div>
        <div style={{ flex: 1, color: '#999', fontSize: 13, lineHeight: 1.5 }}>
          {previewLines.length ? (
            previewLines.map((line, idx) => (
              <div
                key={idx}
                style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {line}
              </div>
            ))
          ) : (
            <div>暂无内容</div>
          )}
        </div>
      </Card>
    );
  };

  const sortedTemplates = useMemo(
    () =>
      [...filteredTemplates].sort(
        (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0),
      ),
    [filteredTemplates],
  );

  const recentTemplates = useMemo(() => {
    const entries = Object.entries(recentUsage || {}).sort(
      ([, timeA], [, timeB]) => (timeB || 0) - (timeA || 0),
    );
    if (entries.length) {
      const templateMap = new Map(sortedTemplates.map((tpl) => [tpl._id, tpl]));
      const ordered = entries.map(([id]) => templateMap.get(id)).filter(Boolean);
      if (ordered.length) {
        return ordered.slice(0, 6);
      }
    }
    return sortedTemplates.slice(0, 3);
  }, [recentUsage, sortedTemplates]);

  const personalTemplates = useMemo(
    () => sortedTemplates.filter((tpl) => tpl.scope === 'personal'),
    [sortedTemplates],
  );
  const appTemplates = useMemo(
    () => sortedTemplates.filter((tpl) => tpl.scope === 'app'),
    [sortedTemplates],
  );

  const scopeMenuItems = useMemo(
    () => [
      { key: 'personal', label: '个人模板' },
      { key: 'app', label: '应用模板', disabled: !appId && !formState.appId },
    ],
    [appId, formState.appId],
  );

  const hasAnyTemplates = templates.length > 0;

  const renderCreateCard = () => (
    <Card
      key="create-card"
      hoverable
      style={{
        width: '100%',
        minHeight: 180,
        borderRadius: 16,
        borderStyle: 'dashed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
      }}
      onClick={handleCreateDocumentCard}
    >
      <Space orientation="vertical" align="center">
        <PlusOutlined style={{ fontSize: 28 }} />
        <Text strong>新建笔记</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          从空白开始记录
        </Text>
      </Space>
    </Card>
  );

  const renderSection = (
    sectionId,
    title,
    data,
    { includeCreateCard = false, emptyMessage, extra, hideWhenEmpty = false, canEdit = true } = {},
  ) => {
    if (!data.length && (hideWhenEmpty || !includeCreateCard)) {
      if (!emptyMessage || hideWhenEmpty) return null;
      return (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong style={{ fontSize: 16 }}>
              {title}
            </Text>
            {extra}
          </div>
          <Empty description={emptyMessage} style={{ marginTop: 16 }} />
        </div>
      );
    }
    return (
      <div style={{ marginTop: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong style={{ fontSize: 16 }}>
            {title}
          </Text>
          {extra}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 16,
            marginTop: 16,
          }}
        >
          {includeCreateCard && renderCreateCard()}
          {data.map((tpl) => renderTemplateCard(tpl, canEdit, sectionId))}
        </div>
      </div>
    );
  };
  return (
    <>
      <Drawer
        title={
          <Space>
            <Text strong style={{ fontSize: 16 }}>
              {resolvedType === 'document' ? '笔记模板' : 'AI提示语'}
            </Text>
            <Button size="small" icon={<ReloadOutlined />} onClick={handleLoad} disabled={loading}>
              刷新
            </Button>
          </Space>
        }
        placement="right"
        size={720}
        onClose={onClose}
        open={open}
        zIndex={1050}
        destroyOnClose={false}
        maskClosable={false}
        keyboard={false}
        styles={{
          body: {
            paddingTop: 16,
            paddingBottom: 16,
            paddingLeft: 24,
            paddingRight: 24,
            overflowY: 'auto',
          },
        }}
      >
        <Space orientation="vertical" style={{ width: '100%' }} size="large">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <Spin />
            </div>
          ) : true ? (
            <>
              {resolvedType === 'document' &&
                renderSection('recent', '最近使用', recentTemplates, {
                  includeCreateCard: type === 'document',
                  hideWhenEmpty: type !== 'document',
                  canEdit: false,
                  extra: resolvedType === 'document' && (
                    <Space size="middle">
                      <Search
                        allowClear
                        placeholder="搜索模板"
                        onSearch={(value) => setKeyword(value)}
                        onChange={(e) => setKeyword(e.target.value)}
                        value={keyword}
                        style={{ width: 220 }}
                      />
                      <Button type="text" icon={<PlusOutlined />} onClick={() => openCreateModal()}>
                        创建模板
                      </Button>
                    </Space>
                  ),
                })}
              {renderSection('personal', '个人模板', personalTemplates, {
                emptyMessage: '暂无个人模板',
                hideWhenEmpty: type === 'document',
                extra: resolvedType !== 'document' && (
                  <Space size="middle">
                    <Search
                      allowClear
                      placeholder="搜索模板"
                      onSearch={(value) => setKeyword(value)}
                      onChange={(e) => setKeyword(e.target.value)}
                      value={keyword}
                      style={{ width: 220 }}
                    />
                    <Button type="text" icon={<PlusOutlined />} onClick={() => openCreateModal()}>
                      创建模板
                    </Button>
                  </Space>
                ),
              })}
              {renderSection('app', '应用模板', appTemplates, {
                emptyMessage: '暂无应用模板',
                hideWhenEmpty: true,
              })}
            </>
          ) : (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <Empty description="目前还没有模板" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                style={{ marginTop: 16 }}
                onClick={() => openCreateModal()}
              >
                创建第一个模板
              </Button>
            </div>
          )}
        </Space>
      </Drawer>

      <DocumentEditorModal
        open={editorVisible}
        title={
          formState.id
            ? `编辑${resolvedType === 'document' ? '模版' : 'AI提示语'}`
            : `新建${resolvedType === 'document' ? '模版' : 'AI提示语'}`
        }
        onClose={closeEditor}
        editorKey={`template-editor-${editorSeed}`}
        editorProps={{
          initialTitle: templateInitialTitle,
          initialBlocks: templateInitialBlocks,
          onChange: handleBlocksChange,
          onTitleChange: handleTitleChange,
          withTitle: true,
          height: 420,
          showAIUI: false,
          placeholderTitle: '输入模板标题',
          readOnly: false,
        }}
        footer={
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            <Space>
              <Dropdown.Button
                type="primary"
                loading={submitting}
                menu={{
                  items: scopeMenuItems,
                  onClick: ({ key }) => handleScopeChange(key),
                }}
                onClick={handleSubmitTemplate}
              >
                {formState.id
                  ? '保存模板'
                  : `创建${formState.scope === 'app' ? '应用' : '个人'}模板`}
              </Dropdown.Button>
            </Space>
          </div>
        }
      />
    </>
  );
};

export default TemplateCenterDrawer;
