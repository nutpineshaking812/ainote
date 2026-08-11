import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Layout,
  Button,
  Input,
  Space,
  Dropdown,
  Tooltip,
  Typography,
  Spin,
  Modal,
  Divider,
  message,
  theme,
  Tag,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FormOutlined,
  PieChartOutlined,
  FileTextOutlined,
  SettingOutlined,
  NodeIndexOutlined,
  DownOutlined,
  AppstoreOutlined,
  PlusCircleOutlined,
  SwapOutlined,
  DatabaseOutlined,
  HomeOutlined,
  RobotOutlined,
  ReadOutlined,
  FolderOpenOutlined,
  FolderAddOutlined,
  SyncOutlined,
  GlobalOutlined,
  RocketOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../store/AuthContext';
import { useOrg } from '../../../store/OrgContext';
import { getApps } from '../../../api/apps';
import CreateAppModal from '../../../features/dashboard/CreateAppModal';
import { useAppResources } from '../context/AppResourcesContext';
import ResourceTree from '../../../features/resource-tree/ResourceTree';
import { deleteDocument } from '../../../api/documents';
import resourceEventBus from '../utils/resourceEventBus';
import { usePermission } from '../../../hooks/usePermission';
import { APP_PERMISSIONS } from '../../../constants/permissions.js';
import useAppStore from '../../../store/useAppStore';
import CategorySelect from '../../../components/common/CategorySelect';

const { Title, Text } = Typography;

// ─── Greeting Logic ──────────────────────────────────────────
function buildGreeting(nickname, t) {
  const hour = new Date().getHours();
  if (hour < 5) return t('greeting.night', { name: nickname }) || `夜深了，${nickname} 🌙`;
  if (hour < 9) return t('greeting.morning', { name: nickname }) || `早上好，${nickname} ☀️`;
  if (hour < 12) return t('greeting.midMorning', { name: nickname }) || `上午好，${nickname} 🌤️`;
  if (hour < 14) return t('greeting.noon', { name: nickname }) || `中午好，${nickname} 🍜`;
  if (hour < 18) return t('greeting.afternoon', { name: nickname }) || `下午好，${nickname} ☕`;
  return t('greeting.evening', { name: nickname }) || `晚上好，${nickname} 🌇`;
}

/**
 * Sidebar header with app title and navigation
 */
const SidebarHeader = ({ appName, onBack, onToggleDisabled }) => {
  const collapsed = useAppStore((state) => state.isSidebarCollapsed);
  const onToggle = useAppStore((state) => state.setSidebarCollapsed);
  const { user } = useAuth();
  const { isPersonalMode, currentOrganization, switchToOrganization, organizations } = useOrg();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const appId = useAppStore((state) => state.currentAppId);

  const { token } = theme.useToken();
  const [apps, setApps] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const nickname = user?.nickname || user?.username || '';
  const greeting = buildGreeting(nickname, t);

  const loadApps = async () => {
    try {
      setLoadingApps(true);
      const data = await getApps();
      setApps(data || []);
    } catch (err) {
      console.error('Failed to load apps', err);
    } finally {
      setLoadingApps(false);
    }
  };

  const handleAppClick = ({ key }) => {
    if (key === 'create-app') {
      setIsCreateModalOpen(true);
      return;
    }

    // Switch app
    const targetApp = apps.find((a) => a.id === key);
    if (targetApp && key !== appId) {
      navigate(`/apps/${targetApp.id}`, { state: { appName: targetApp.name } });
    }
  };

  const appMenuItems = [
    {
      key: 'apps-group',
      type: 'group',
      label: t('common.applications'),
      children: apps.map((app) => ({
        key: app.id,
        label: app.name,
        icon: <AppstoreOutlined />,
        disabled: app.id === appId,
      })),
    },
    { type: 'divider' },
    {
      key: 'create-app',
      label: t('dashboard.createApp'),
      icon: <PlusCircleOutlined style={{ color: '#2383e2' }} />,
    },
  ];

  const appNameShort = appName
    ? appName
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 3)
        .toUpperCase()
    : '';

  return (
    <>
      <div
        className="sider-header"
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '10px 10px 8px 10px',
          gap: '2px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '2px' }}>
          {/* Back button */}
          {!isPersonalMode && (
            <Tooltip title={t('common.back')}>
              <Button
                type="text"
                size="small"
                icon={<ArrowLeftOutlined style={{ fontSize: '13px' }} />}
                onClick={onBack}
                style={{
                  flexShrink: 0,
                  color: '#787774',
                  width: '24px',
                  height: '24px',
                  padding: 0,
                }}
              />
            </Tooltip>
          )}

          <Dropdown
            trigger={['click']}
            menu={{ items: appMenuItems, onClick: handleAppClick }}
            onOpenChange={(open) => open && loadApps()}
            placement="bottomLeft"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                minWidth: 0,
                gap: '8px',
                padding: '2px 6px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              className="sidebar-user"
            >
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '3px',
                  background: token.colorPrimary,
                  color: '#fff',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontWeight: 600,
                }}
              >
                {appNameShort || 'A'}
              </div>
              {!collapsed && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    minWidth: 0,
                    flex: 1,
                    gap: '4px',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <Text
                      strong
                      style={{
                        fontSize: '14px',
                        lineHeight: '20px',
                        letterSpacing: '-0.01em',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                      }}
                    >
                      {appName}
                    </Text>
                    {isPersonalMode && (
                      <Tag
                        variant="filled"
                        color="success"
                        style={{
                          margin: 0,
                          fontSize: '10px',
                          lineHeight: '16px',
                          padding: '0 4px',
                          flexShrink: 0,
                        }}
                      >
                        {t('common.personal') || '个人空间'}
                      </Tag>
                    )}
                  </div>
                  <DownOutlined
                    style={{ fontSize: '8px', color: '#787774', flexShrink: 0, marginTop: '1px' }}
                  />
                </div>
              )}
            </div>
          </Dropdown>

          <Tooltip title={t(collapsed ? 'dashboard.expandSidebar' : 'dashboard.collapseSidebar')}>
            <Button
              type="text"
              size="small"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={onToggle}
              disabled={onToggleDisabled}
              style={{
                flexShrink: 0,
                color: '#acaba9',
                width: '24px',
                height: '24px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          </Tooltip>
        </div>

        {/* Resident Items: Home & Search */}
        <div
          style={{
            marginTop: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            padding: collapsed ? '0 8px' : 0,
          }}
        >
          <Tooltip title={collapsed ? t('common.home') : ''} placement="right">
            <div
              className="hover-item"
              onClick={() => {
                navigate(`/apps/${appId}#/home`);
                resourceEventBus.emit('resource:selected', { type: 'home' });
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? '6px 0' : '4px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                gap: collapsed ? 0 : '10px',
                height: '30px',
                background:
                  location.pathname === `/apps/${appId}` &&
                  (!location.hash || location.hash === '#/home')
                    ? 'rgba(55, 53, 47, 0.08)'
                    : 'transparent',
              }}
            >
              <HomeOutlined style={{ fontSize: '16px', color: '#91918e' }} />
              {!collapsed && (
                <Text
                  style={{
                    fontSize: '14px',
                    color: '#37352f',
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {t('common.home') || '首页'}
                </Text>
              )}
            </div>
          </Tooltip>

          {/* 圆桌会 (Playroom) */}
          <Tooltip title={collapsed ? '圆桌会' : ''} placement="right">
            <div
              className="hover-item"
              onClick={() => {
                navigate(`/apps/${appId}#/playroom`);
                resourceEventBus.emit('resource:selected', { type: 'playroom' });
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? '6px 0' : '4px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                gap: collapsed ? 0 : '10px',
                height: '30px',
                background:
                  location.pathname === `/apps/${appId}` &&
                  location.hash === '#/playroom'
                    ? 'rgba(55, 53, 47, 0.08)'
                    : 'transparent',
              }}
            >
              <TeamOutlined style={{ fontSize: '16px', color: '#6366f1' }} />
              {!collapsed && (
                <Text
                  style={{
                    fontSize: '14px',
                    color: '#37352f',
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                  }}
                >
                  圆桌会
                </Text>
              )}
            </div>
          </Tooltip>
        </div>
      </div>

      <CreateAppModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onAppCreated={(newApp) => {
          setIsCreateModalOpen(false);
          navigate(`/apps/${newApp.id}`, { state: { appName: newApp.name } });
        }}
      />
    </>
  );
};

/**
 * Resource creation toolbar with search and create dropdown
 */
const ResourceToolbar = ({ allowCreate, menuProps, onForceSync }) => {
  const collapsed = useAppStore((state) => state.isSidebarCollapsed);
  const { t } = useTranslation();
  const [syncing, setSyncing] = useState(false);

  if (collapsed) return null;

  return (
    <div
      style={{
        padding: '16px 12px 6px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text
        type="secondary"
        style={{
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          color: 'rgba(55, 53, 47, 0.45)',
        }}
      >
        {t('sidebar.recents') || '资源列表'}
      </Text>
      <Space size={4}>
        <Tooltip title={t('sidebar.forceSync', '强制同步')}>
          <Button
            type="text"
            htmlType="button"
            loading={syncing}
            icon={!syncing && <SyncOutlined style={{ color: 'rgba(55, 53, 47, 0.45)', fontSize: '13px' }} />}
            size="small"
            onClick={async (e) => {
              e?.preventDefault?.();
              e?.stopPropagation?.();
              if (syncing) return;
              setSyncing(true);
              try {
                await onForceSync?.();
              } finally {
                setSyncing(false);
              }
            }}
            style={{ width: '20px', height: '20px', padding: 0 }}
          />
        </Tooltip>
        {allowCreate && menuProps?.items?.length > 0 && (
          <Dropdown trigger={['click']} styles={{ root: { minWidth: 160 } }} menu={menuProps}>
            <Button
              type="text"
              icon={<PlusOutlined style={{ color: 'rgba(55, 53, 47, 0.45)', fontSize: '14px' }} />}
              size="small"
              style={{ width: '20px', height: '20px', padding: 0 }}
            />
          </Dropdown>
        )}
      </Space>
    </div>
  );
};

/**
 * Main sidebar component with header, toolbar, and resource tree
 */
const AppSidebar = ({ appName }) => {
  const appId = useAppStore((state) => state.currentAppId);
  const collapsed = useAppStore((state) => state.isSidebarCollapsed);
  const onToggle = useAppStore((state) => state.setSidebarCollapsed);

  const { t } = useTranslation();
  const { isPersonalMode } = useOrg();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    treeData,
    rawResources,
    searchNodes,
    searchQuery,
    expandedKeys,
    loadingResources,
    selectedResource,
    forceSync,
    filterResources,
    handleTreeExpand,
    loadingNodeKeys,
    reloadNode,
    deleteResource,
    selectResource,
    setExpandedKeys,
    createChildDocumentNode,
    moveResource,
    createResource,
    updateResourceMeta,
    updateResourceCacheMeta,
  } = useAppResources();

  const { hasAppPermission, isOrgOwner } = usePermission();
  const canManageApp = hasAppPermission(APP_PERMISSIONS.APP_MANAGE);
  const canCreateSomething =
    hasAppPermission(APP_PERMISSIONS.FORM_DESIGN) ||
    hasAppPermission(APP_PERMISSIONS.VIEW_DESIGN) ||
    hasAppPermission(APP_PERMISSIONS.DOC_MANAGE);

  const [showDocModal, setShowDocModal] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsNode, setSettingsNode] = useState(null);
  const [folderCategories, setFolderCategories] = useState([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderTitle, setFolderTitle] = useState('');
  const [pendingParentId, setPendingParentId] = useState(null);

  const getCreateMenu = (parentId = null) => {
    const items = [
      hasAppPermission(APP_PERMISSIONS.FORM_DESIGN) && {
        key: 'form',
        icon: <FormOutlined />,
        label: t('sidebar.newForm'),
      },
      hasAppPermission(APP_PERMISSIONS.VIEW_DESIGN) && {
        key: 'view',
        icon: <PieChartOutlined />,
        label: t('sidebar.newView'),
      },
      (hasAppPermission(APP_PERMISSIONS.FORM_DESIGN) ||
        hasAppPermission(APP_PERMISSIONS.VIEW_DESIGN)) && {
        type: 'divider',
      },
      hasAppPermission(APP_PERMISSIONS.APP_VIEW) && {
        key: 'document',
        icon: <FileTextOutlined />,
        label: t('sidebar.newDocument'),
      },
      { type: 'divider' },
      hasAppPermission(APP_PERMISSIONS.APP_VIEW) && {
        key: 'folder',
        icon: <FolderAddOutlined />,
        label: t('sidebar.newFolder', '新建文件夹'),
      },
    ].filter(Boolean);

    const handleMenuClick = ({ key }) => {
      setPendingParentId(parentId);
      const queryParams = parentId ? `?parentId=${parentId}` : '';
      switch (key) {
        case 'form':
          return navigate({
            pathname: `/apps/${appId}/forms/new`,
            search: queryParams,
            hash: '#/edit',
          });
        case 'view':
          return navigate(`/apps/${appId}/views/new${queryParams}`);
        case 'document':
          return handleCreateDocument();
        case 'folder':
          return handleCreateFolder();
        default:
          break;
      }
    };

    return { items, onClick: handleMenuClick };
  };

  // Listen for resource events and update cache via context methods
  useEffect(() => {
    const handleResourceUpdated = ({ type, id, data }) => {
      if (type === 'document') {
        // Merge title (name) and any meta fields (isSkill, skillName, etc.) into the cache
        const metaUpdate = {};
        if (data?.meta) Object.assign(metaUpdate, data.meta);
        if (data?.title !== undefined) metaUpdate.name = data.title;
        if (Object.keys(metaUpdate).length > 0) {
          updateResourceCacheMeta(type, id, metaUpdate).catch((err) =>
            console.warn('[AppSidebar] Failed to update resource meta in cache', err),
          );
        }
      }
    };

    const handleResourceDeleted = ({ type, id, navigateTo, parentType }) => {
      // NOTE: ResourceCache is already updated by deleteResource() which calls
      // removeResourceFromCache internally. This handler is ONLY for navigation.
      const isCurrentSelected =
        selectedResource?.type === type &&
        (selectedResource?.refId?.toString() === id?.toString() ||
          selectedResource?.id?.toString() === id?.toString() ||
          selectedResource?._id?.toString() === id?.toString());

      if (isCurrentSelected) {
        if (navigateTo === 'clear' || !navigateTo) {
          navigate({ pathname: location.pathname, hash: '' }, { replace: true });
        } else {
          // Use parentType if available, otherwise default to document
          const routeType = parentType || 'document';
          const newHash = `#/${routeType}/${navigateTo}`;
          navigate({ pathname: location.pathname, hash: newHash }, { replace: true });
        }
      }
    };

    resourceEventBus.on('resource:updated', handleResourceUpdated);
    resourceEventBus.on('resource:deleted', handleResourceDeleted);
    return () => {
      resourceEventBus.off('resource:updated', handleResourceUpdated);
      resourceEventBus.off('resource:deleted', handleResourceDeleted);
    };
  }, [selectedResource, navigate, location.pathname, updateResourceCacheMeta]);

  const handleBack = () => navigate('/');

  const handleSearch = (e) => {
    filterResources(e.target.value);
  };

  const handleCreateDocument = () => {
    setDocTitle('');
    setShowDocModal(true);
  };

  const submitCreateDocument = async () => {
    if (!docTitle.trim()) {
      message.warning(t('sidebar.enterDocumentTitle'));
      return;
    }

    const result = await createResource('document', {
      title: docTitle.trim(),
      parentId: pendingParentId,
    });
    if (result.success) {
      setShowDocModal(false);
      setPendingParentId(null);
      const doc = result.data;
      if (doc?._id) {
        // Navigate to new document (useResourceRouting will handle selectResource)
        navigate({ pathname: location.pathname, hash: `#/document/${doc._id}` }, { replace: true });
        resourceEventBus.emit('resource:created', { type: 'document', id: doc._id, data: doc });
      }
      message.success(t('sidebar.documentCreated'));
    }
  };

  const handleCreateFolder = () => {
    setFolderTitle('');
    setShowFolderModal(true);
  };

  const submitCreateFolder = async () => {
    if (!folderTitle.trim()) {
      message.warning(t('sidebar.enterFolderTitle', '请输入文件夹名称'));
      return;
    }

    const result = await createResource('folder', {
      title: folderTitle.trim(),
      parentId: pendingParentId,
    });
    if (result.success) {
      setShowFolderModal(false);
      setPendingParentId(null);
      message.success(t('sidebar.folderCreated', '文件夹已创建'));
    }
  };

  const handleTreeSelect = (key, info) => {
    if (!key) return;
    const data = info?.node?.data || {};
    const rawType = data.type;
    // Use data.refId for URL (backward compatible)
    const refId = data.refId;
    // Use data._id for internal management
    const resourceId = data.id;
    const routeType = rawType === 'document' ? 'document' : rawType;

    // Navigate using refId (Form._id / View._id / Document._id)
    navigate({ pathname: location.pathname, hash: `#/${routeType}/${refId}` });
    resourceEventBus.emit('resource:selected', {
      type: routeType,
      id: resourceId, // Panel uses refId
      refId: refId,
    });
  };

  const handleTreeRefresh = async (node, createdDoc) => {
    try {
      await reloadNode(node, createdDoc || null);
      if (createdDoc) {
        const newId = createdDoc._id || createdDoc.refId;
        if (newId) {
          setExpandedKeys((keys) => (keys.includes(node.key) ? keys : [...keys, node.key]));
          // Only navigate, let useResourceRouting handle selectResource
          navigate({ pathname: location.pathname, hash: `#/document/${newId}` }, { replace: true });
          resourceEventBus.emit('resource:created', {
            type: 'document',
            id: newId,
            data: createdDoc,
          });
        }
      }
    } catch (e) {
      console.warn('Failed to refresh node', e);
    }
  };

  const handleTreeDelete = async (docId, nodeObj) => {
    if (!docId) return;

    const data = nodeObj?.data || {};
    const type = data.type || 'document';

    try {
      // deleteResource handles API call and cache update
      const result = await deleteResource(type, docId);
      if (!result?.success) return;

      // Determine parent info from data instead of relying on nodeObj.parent
      const parentIdFromData = data.parentId;
      let parentId = null;
      let parentType = null;

      if (parentIdFromData) {
        // Find the parent resource in rawResources to get its type
        const parentResource = rawResources.find(
          (r) => r.id === parentIdFromData || r.refId === parentIdFromData,
        );
        if (parentResource) {
          parentId = parentResource.refId || parentResource.id;
          parentType = parentResource.type;
        }
      }

      resourceEventBus.emit('resource:deleted', {
        type: type,
        id: docId,
        navigateTo: parentId || 'clear',
        parentType: parentType,
      });
    } catch (err) {
      console.error('[AppSidebar] Delete resource failed:', err);
      const errorMsg =
        err.response?.data?.message ||
        (type === 'folder' ? '删除文件夹失败' : t('sidebar.deleteDocumentFailed'));
      message.error(errorMsg);
    }
  };

  const handleTreeCreate = async (treeNode) => {
    // If it's a folder, we might want it to act like a plus button
    // But since we are using getCreateMenu, this will only be called if getCreateMenu is NOT provided
    // or if the user clicks the plus button on a non-folder container document.
    const data = treeNode?.data || {};
    const parentId = data.id;
    if (!parentId) return;

    // Default to document creation for non-folder containers if needed
    try {
      const docObj = await createChildDocumentNode({ parentId, parentNode: treeNode });
      const docId = docObj?.id;
      if (!docId) {
        message.error(t('sidebar.createFailed'));
        return;
      }
      navigate({ pathname: location.pathname, hash: `#/document/${docId}` }, { replace: true });
      resourceEventBus.emit('resource:created', { type: 'document', id: docId, data: docObj });
      message.success(t('sidebar.childDocumentCreated'));
    } catch (err) {
      console.error('create child doc failed', err);
      message.error(err?.message || t('sidebar.createDocumentFailed'));
    }
  };

  const handleTreeCreateMenu = (node) => {
    const data = node?.data || {};
    // Only folders get the full menu
    if (data.type === 'folder') {
      return getCreateMenu(data.id);
    }
    // Documents that are containers might just get document creation
    return null;
  };

  const handleOpenFolderSettings = (node) => {
    setSettingsNode(node);
    setFolderCategories(node.data?.meta?.categoryKeys || []);
    setShowSettingsModal(true);
  };

  const submitFolderSettings = async () => {
    if (!settingsNode) return;
    const { refId, type } = settingsNode.data;
    const result = await updateResourceMeta(type, refId, { categoryKeys: folderCategories });
    if (result.success || result) {
      message.success('文件夹标签已更新');
      setShowSettingsModal(false);
    }
  };

  // Generate selected key using refId to match tree nodes
  const selectedKey = selectedResource
    ? `${selectedResource.type}-${selectedResource.refId}`
    : null;

  return (
    <>
      <div
        className={collapsed ? 'app-sider collapsed' : 'app-sider'}
        style={{
          background: '#fbfbfa',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          width: '100%',
          border: 'none',
        }}
      >
        {/* 顶部固定区域 */}
        <div style={{ flexShrink: 0, borderBottom: '1px solid #edece9' }}>
          <SidebarHeader
            appName={appName}
            onBack={handleBack}
            onToggleDisabled={(!loadingResources && treeData.length === 0) || !selectedResource}
          />
        </div>

        {/* 中间滚动区域 */}
        <div
          style={{
            overflowY: 'auto',
            flexGrow: 1,
            height: 0,
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ResourceToolbar
            allowCreate={canCreateSomething}
            menuProps={getCreateMenu(null)}
            onForceSync={forceSync}
          />

          <div style={{ flexGrow: 1 }}>
            {loadingResources ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                <Spin />
              </div>
            ) : (
              <ResourceTree
                nodes={searchQuery ? searchNodes : treeData}
                onRefreshNode={handleTreeRefresh}
                onSelect={handleTreeSelect}
                onDelete={handleTreeDelete}
                onCreate={handleTreeCreate}
                getCreateMenu={handleTreeCreateMenu}
                onSettings={handleOpenFolderSettings}
                onMove={moveResource}
                selectedKey={selectedKey}
                expandedKeys={expandedKeys}
                onExpand={handleTreeExpand}
                allowCreate={canCreateSomething}
                loadingKeys={loadingNodeKeys}
              />
            )}
          </div>

          {/* 底部功能区域 (现已参与滚动) */}
          {!collapsed && canManageApp && (
            <div
              style={{
                padding: '24px 12px 12px 12px',
                flexShrink: 0,
              }}
            >
              <div style={{ padding: '0 4px 6px 4px' }}>
                <Text
                  type="secondary"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                    color: 'rgba(55, 53, 47, 0.4)',
                  }}
                >
                  {t('admin.nav.managementTools') || '管理工具'}
                </Text>
              </div>
              {isOrgOwner && (
                <>
                  <div
                    className="hover-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      gap: '10px',
                      height: '30px',
                      marginBottom: '2px',
                      background:
                        location.pathname === `/apps/${appId}` && location.hash === '#/gateway'
                          ? 'rgba(55, 53, 47, 0.08)'
                          : 'transparent',
                    }}
                    onClick={() => {
                      navigate(`/apps/${appId}/integrations`);
                    }}
                  >
                    <GlobalOutlined style={{ fontSize: '16px', color: '#91918e' }} />
                    <Text style={{ fontSize: '14px', color: '#37352f', fontWeight: 500 }}>
                      AI网关
                    </Text>
                  </div>

                  <div
                    className="hover-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      gap: '10px',
                      height: '30px',
                      marginBottom: '2px',
                      background:
                        location.pathname === `/apps/${appId}/digital-employees` ||
                        location.pathname.startsWith(`/apps/${appId}/digital-employees/`)
                          ? 'rgba(55, 53, 47, 0.08)'
                          : 'transparent',
                    }}
                    onClick={() => navigate(`/apps/${appId}/digital-employees`)}
                  >
                    <RobotOutlined style={{ fontSize: '16px', color: '#91918e' }} />
                    <Text style={{ fontSize: '14px', color: '#37352f', fontWeight: 500 }}>
                      {t('sidebar.digitalEmployees') || '数字员工'}
                    </Text>
                  </div>
                  <div
                    className="hover-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      gap: '10px',
                      height: '30px',
                      marginBottom: '2px',
                    }}
                    onClick={() => navigate(`/apps/${appId}/knowledge-sets`)}
                  >
                    <ReadOutlined style={{ fontSize: '16px', color: '#91918e' }} />
                    <Text style={{ fontSize: '14px', color: '#37352f', fontWeight: 500 }}>
                      {t('sidebar.knowledgeSets') || '知识集'}
                    </Text>
                  </div>
                  <div
                    className="hover-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      gap: '10px',
                      height: '30px',
                      marginBottom: '2px',
                    }}
                    onClick={() => navigate(`/apps/${appId}/workflows`)}
                  >
                    <NodeIndexOutlined style={{ fontSize: '16px', color: '#91918e' }} />
                    <Text style={{ fontSize: '14px', color: '#37352f', fontWeight: 500 }}>
                      {t('sidebar.workflows')}
                    </Text>
                  </div>
                </>
              )}
              <div
                className="hover-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  gap: '10px',
                  height: '30px',
                }}
                onClick={() =>
                  navigate(`/apps/${appId}/settings/${isPersonalMode ? 'info' : 'permissions'}`)
                }
              >
                <SettingOutlined style={{ fontSize: '16px', color: '#91918e' }} />
                <Text style={{ fontSize: '14px', color: '#37352f', fontWeight: 500 }}>
                  {t('appSettings.title') || '应用设置'}
                </Text>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        title={t('sidebar.newDocumentTitle')}
        open={showDocModal}
        onOk={submitCreateDocument}
        onCancel={() => setShowDocModal(false)}
        okText={t('common.create')}
        cancelText={t('dataset.cancel')}
        destroyOnHidden
      >
        <Input
          placeholder={t('sidebar.enterTitlePlaceholder')}
          value={docTitle}
          onChange={(e) => setDocTitle(e.target.value)}
          onPressEnter={submitCreateDocument}
        />
        <Divider />
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {t('sidebar.newDocumentDescription')}
        </Typography.Paragraph>
      </Modal>

      <Modal
        title={t('sidebar.newFolderTitle', '新建文件夹')}
        open={showFolderModal}
        onOk={submitCreateFolder}
        onCancel={() => setShowFolderModal(false)}
        okText={t('common.create')}
        cancelText={t('dataset.cancel')}
        destroyOnHidden
      >
        <Input
          placeholder={t('sidebar.enterFolderTitlePlaceholder', '请输入文件夹名称')}
          value={folderTitle}
          onChange={(e) => setFolderTitle(e.target.value)}
          onPressEnter={submitCreateFolder}
          autoFocus
        />
      </Modal>

      <Modal
        title="文件夹设置"
        open={showSettingsModal}
        onOk={submitFolderSettings}
        onCancel={() => setShowSettingsModal(false)}
        destroyOnHidden
      >
        <div style={{ marginBottom: '12px' }}>
          <Text strong>选择业务标签</Text>
        </div>
        <CategorySelect value={folderCategories} onChange={setFolderCategories} />
        <div style={{ marginTop: '16px', color: '#8c8c8c', fontSize: '12px' }}>
          设置标签后，该文件夹下的所有笔记将自动激活对应的业务动作（如同步、审批等）。
        </div>
      </Modal>
    </>
  );
};

export default AppSidebar;
