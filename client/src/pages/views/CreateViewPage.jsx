import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout, Button, Tabs, Modal, Drawer, message, Typography } from 'antd';
import {
  ArrowLeftOutlined,
  ShareAltOutlined,
  BellOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import UserAvatarDropdown from '../../components/UserAvatarDropdown.jsx';
import InlineEditableTitle from '../../components/InlineEditableTitle.jsx';
import { ChatProvider } from '../../features/chat/context/ChatProvider.jsx';
import ChatAssistant from '../../features/chat/components/ChatAssistant.jsx';
import ViewBuilderContent from '../../features/views/components/ViewBuilderContent.jsx';
import FormPublishView from '../form/PublishView.jsx';
import { listConversations } from '../../api/conversations.js';
import { getView, createView, updateView, shareView } from '../../api/views.js';
import DocumentShareModal from '../../features/documents/components/DocumentShareModal.jsx';

const { Header, Content } = Layout;
const { Title, Paragraph } = Typography;

const HASH_TO_TAB = { '#/edit': 'builder', '#/publish': 'publish' };
const TAB_TO_HASH = { builder: '#/edit', publish: '#/publish' };

const CreateViewPage = () => {
  const { t } = useTranslation();
  const { appId, viewId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState(
    () => HASH_TO_TAB[(location.hash || '').toLowerCase()] || 'builder',
  );

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const parentId = queryParams.get('parentId');

  const [headerTitle, setHeaderTitle] = useState(t('createView.designer'));
  const [onHeaderTitleChange, setOnHeaderTitleChange] = useState(null);
  const [viewData, setViewData] = useState(null); // { name, description, charts: [] }
  const [savedViewData, setSavedViewData] = useState(null);
  const [isViewLoading, setIsViewLoading] = useState(true);
  const [unsavedPromptVisible, setUnsavedPromptVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  // charts managed here and passed into builder content

  // Sync tab with hash
  useEffect(() => {
    const normalizedHash = (location.hash || '').toLowerCase();
    setActiveTab(HASH_TO_TAB[normalizedHash] || 'builder');
  }, [location.hash]);

  useEffect(() => {
    const desiredHash = TAB_TO_HASH[activeTab] || '';
    const currentHash = window.location.hash || '';
    if (desiredHash !== currentHash) {
      const { pathname, search } = location;
      navigate(`${pathname}${search}${desiredHash}`, { replace: true });
    }
  }, [activeTab, location, navigate]);

  // Load or initialize view (new architecture: view has layout referencing componentIds)
  useEffect(() => {
    let cancelled = false;
    const applyView = (v, chartsFromLayout = []) => {
      if (cancelled) return;
      const initial =
        v ||
        (viewId === 'new'
          ? { _id: 'new', name: t('createView.newView'), description: '', charts: [] }
          : null);
      if (chartsFromLayout.length) {
        initial.charts = chartsFromLayout;
      }
      setViewData(initial);
      setSavedViewData(initial ? JSON.parse(JSON.stringify(initial)) : null);
      if (initial?.name) setHeaderTitle(initial.name);
      else if (viewId === 'new') setHeaderTitle(t('createView.newView'));
      else setHeaderTitle(t('createView.designer'));
      setIsViewLoading(false);
    };
    if (!appId || !viewId) {
      applyView(null);
      return () => {
        cancelled = true;
      };
    }
    if (viewId === 'new') {
      applyView(null);
      return () => {
        cancelled = true;
      };
    }
    const load = async () => {
      try {
        const v = await getView(appId, viewId);
        // console.log('Loaded view:', v);
        // Convert layout -> charts (directly map; ComponentDataChart will fetch data later)
        let chartsFromLayout = [];
        if (Array.isArray(v?.layout) && v.layout.length) {
          try {
            chartsFromLayout = v.layout.map((layoutItem) => ({
              id: layoutItem.layoutId,
              layoutId: layoutItem.layoutId,
              componentId: layoutItem.componentId,
              chartType: (layoutItem.chartType || 'bar').toLowerCase(),
              title: layoutItem.title || t('createView.chart'),
              isTable: layoutItem.chartType === 'table',
              layout: {
                x: layoutItem.x,
                y: layoutItem.y,
                w: layoutItem.w,
                h: layoutItem.h,
                z: layoutItem.z,
                locked: layoutItem.locked,
              },
            }));
          } catch (e) {
            // partial failure tolerated
          }
        }
        applyView(v, chartsFromLayout);
      } catch (e) {
        applyView(null);
      }
    };
    setIsViewLoading(true);
    load();
    return () => {
      cancelled = true;
    };
  }, [appId, viewId, t]);

  const hasUnsavedChanges = useMemo(() => {
    if (!viewData || !savedViewData) return false;
    // console.log('Comparing viewData and savedViewData for unsaved changes:', viewData, savedViewData);
    try {
      return JSON.stringify(viewData) !== JSON.stringify(savedViewData);
    } catch {
      return false;
    }
  }, [viewData, savedViewData]);

  const handleTitleEdit = useCallback(
    (nextValue) => {
      const finalValue = (nextValue || '').trim() || t('createView.newView');
      setHeaderTitle(finalValue);
      if (typeof onHeaderTitleChange === 'function') onHeaderTitleChange(finalValue);
      setViewData((prev) => (prev ? { ...prev, name: finalValue } : prev));
    },
    [onHeaderTitleChange, t],
  );

  const markViewSaved = useCallback(
    (data) => {
      const snapshot = data || viewData;
      setSavedViewData(snapshot ? JSON.parse(JSON.stringify(snapshot)) : null);
      if (snapshot?.name) setHeaderTitle(snapshot.name);
    },
    [viewData],
  );

  const [charts, setCharts] = useState([]);
  useEffect(() => {
    if (viewData?.charts && Array.isArray(viewData.charts)) setCharts(viewData.charts);
  }, [viewData]);

  const performSave = useCallback(
    async ({ redirect = false } = {}) => {
      if (!viewData) {
        message.warning(t('createView.viewNotLoaded'));
        return false;
      }
      try {
        setIsSaving(true);

        // Build layout array from current charts with positions and messageId
        const layout = charts.map((c, idx) => {
          const layoutItem = {
            layoutId: c.layoutId, // Preserve layoutId from load or will be generated by backend
            x: c.layout?.x ?? idx % 4,
            y: c.layout?.y ?? Infinity,
            w: c.layout?.w ?? (c.isTable ? 2 : 1),
            h: c.layout?.h ?? (c.isTable ? 10 : 9),
            z: c.layout?.z ?? 0,
            locked: c.layout?.locked ?? false,
          };

          // Include either componentId (existing) or messageId (needs creation)
          if (c.componentId) {
            layoutItem.componentId = c.componentId;
          }
          if (c.messageId) {
            layoutItem.messageId = c.messageId;
            if (c.segmentId) {
              layoutItem.segmentId = c.segmentId;
            }
          }

          return layoutItem;
        });

        // Prepare payload with layout (containing both componentId and messageId)
        const payload = {
          name: viewData.name,
          description: viewData.description,
          layout,
        };

        let persisted;
        let effectiveViewId = viewId;

        if (viewId === 'new') {
          persisted = await createView(appId, { ...payload, parentId });
          effectiveViewId = persisted._id || persisted.id;
          message.success(t('createView.createSuccess'));
        } else {
          persisted = await updateView(appId, viewId, payload);
          message.success(t('createView.saveSuccess'));
        }

        // Update local state with server response
        const snapshot = { ...(persisted || payload), charts };
        markViewSaved(snapshot);
        setViewData((prev) => (prev ? { ...snapshot } : snapshot));

        // Navigate if new view
        if (viewId === 'new' && effectiveViewId) {
          const newId = effectiveViewId;
          const currentHash = location.hash || '';
          navigate(`/apps/${appId}/views/${newId}${currentHash}`, { replace: true });
        }
        if (redirect) {
          navigate({ pathname: `/apps/${appId}`, hash: `#/view/${effectiveViewId || viewId}` });
        }
        return true;
      } catch (e) {
        message.error(t('createView.saveFailed'));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [viewData, charts, viewId, appId, markViewSaved, navigate, location.hash, t],
  );

  const handleShareSave = useCallback(async (id, shares) => {
    await shareView(appId, id, shares);
    setViewData((prev) => (prev ? { ...prev, shares } : prev));
  }, [appId]);

  const navigateBack = useCallback(() => {
    const resolvedId = viewId === 'new' ? viewData && (viewData._id || viewData.id) : viewId;
    const targetId = resolvedId && resolvedId !== 'new' ? resolvedId : undefined;
    navigate({ pathname: `/apps/${appId}`, hash: targetId ? `#/view/${targetId}` : '' });
  }, [navigate, appId, viewId, viewData]);

  const handleBackClick = useCallback(() => {
    if (hasUnsavedChanges) setUnsavedPromptVisible(true);
    else navigateBack();
  }, [hasUnsavedChanges, navigateBack]);

  const handleSaveAndExit = useCallback(() => {
    performSave({ redirect: true }).then((success) => {
      if (!success) setUnsavedPromptVisible(true);
      else setUnsavedPromptVisible(false);
    });
  }, [performSave]);
  const handleDiscardAndExit = useCallback(() => {
    markViewSaved(savedViewData);
    setUnsavedPromptVisible(false);
    navigateBack();
  }, [markViewSaved, savedViewData, navigateBack]);
  const handleContinueEditing = useCallback(() => setUnsavedPromptVisible(false), []);

  const suggestions = useMemo(() => [], []);
  const canSave = !isViewLoading && Boolean(viewData) && !isSaving && activeTab === 'builder';
  const canPreview = activeTab === 'builder' && !isViewLoading && Boolean(viewData);

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden', background: '#ffffff' }}>
      <Layout.Header
        style={{
          background: '#ffffff',
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 64,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flex: '1 1 0%' }}>
          <ArrowLeftOutlined
            onClick={handleBackClick}
            style={{ marginRight: 16, cursor: 'pointer', fontSize: 16 }}
          />
          <InlineEditableTitle
            value={headerTitle}
            defaultValue={t('createView.newView')}
            onChange={handleTitleEdit}
          />
        </div>
        <div style={{ flex: 2, display: 'flex', justifyContent: 'center' }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              { key: 'builder', label: t('createView.design') },
              // { key: 'publish', label: '发布配置' }
            ]}
            size="large"
            tabBarStyle={{ margin: 0 }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flex: 1,
            justifyContent: 'flex-end',
          }}
        >
          <Button onClick={() => setIsPreviewVisible(true)} disabled={!canPreview}>
            {t('createView.preview')}
          </Button>
          <Button
            type="primary"
            onClick={() => performSave()}
            loading={isSaving}
            disabled={!canSave}
          >
            {t('createView.save')}
          </Button>
          {/* <Button
            icon={<ShareAltOutlined />}
            onClick={() => setShareModalVisible(true)}
            disabled={!viewData || viewId === 'new'}
          >
            {t('createView.share')}
          </Button> */}
          <BellOutlined />
          <QuestionCircleOutlined />
          <UserAvatarDropdown />
        </div>
      </Layout.Header>
      <div style={{ display: 'flex', flexDirection: 'row', height: 'calc(100vh - 64px)' }}>
        {activeTab === 'builder' && (
          <ViewBuilderContent
            appId={appId}
            viewId={viewId}
            charts={charts}
            setCharts={setCharts}
            setViewData={setViewData}
            initialSuggestions={suggestions}
          />
        )}
        {activeTab === 'publish' && (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <FormPublishView />
          </div>
        )}
      </div>
      <Modal
        open={unsavedPromptVisible}
        title={t('createView.unsavedChangesTitle')}
        onCancel={handleContinueEditing}
        centered
        maskClosable={false}
        footer={[
          <Button key="continue" onClick={handleContinueEditing}>
            {t('createView.continueEditing')}
          </Button>,
          <Button key="discard" danger onClick={handleDiscardAndExit}>
            {t('createView.discardChanges')}
          </Button>,
          <Button
            key="save"
            type="primary"
            onClick={handleSaveAndExit}
            loading={isSaving}
            disabled={!canSave}
          >
            {t('createView.save')}
          </Button>,
        ]}
      >
        <p>{t('createView.unsavedChangesPrompt')}</p>
      </Modal>
      <Drawer
        title={viewData?.name || t('createView.viewPreview')}
        open={isPreviewVisible}
        onClose={() => setIsPreviewVisible(false)}
        placement="bottom"
        size={600}
        footer={null}
      >
        {/* Simple preview: reuse ChartCanvas read-only */}
        {/* <ChartCanvas charts={charts} readOnly /> */}
      </Drawer>
      <DocumentShareModal
        open={shareModalVisible}
        onCancel={() => setShareModalVisible(false)}
        onSave={handleShareSave}
        doc={viewData}
        title={t('createView.shareViewTitle')}
      />
    </Layout>
  );
};

export default CreateViewPage;
