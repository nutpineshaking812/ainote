import React, { useState, useEffect } from 'react';
import {
  Button,
  Row,
  Col,
  Spin,
  Alert,
  message,
  Space,
  Typography,
  Input,
  Tooltip,
  Card,
  Empty,
  Layout,
  Modal,
  Drawer,
} from 'antd';
import PageHeader from '../../components/PageHeader';
import {
  AppstoreOutlined,
  UserOutlined,
  SwapOutlined,
  HistoryOutlined,
  StarOutlined,
  DashboardOutlined,
  SettingOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useOrg } from '../../store/OrgContext';
import { getApps, deleteApp } from '../../api/apps.js';
import {
  touchRecent as apiPushRecentApp,
  toggleFavorite as apiToggleFavorite,
  getDashboardSummary,
  setDashboardView,
} from '../../api/dashboard.js';
import AppCard from './AppCard.jsx';
import * as AntdIcons from '@ant-design/icons';
import CreateAppModal from './CreateAppModal.jsx';
import EditAppModal from './EditAppModal.jsx';
import DeleteAppModal from './DeleteAppModal.jsx';
import ViewDisplay from '../../components/ViewDisplay.jsx';
import DashboardViewEditModal from '../../components/DashboardViewEditModal.jsx';
import Permission from '../../components/Permission';
import { useAuth } from '../../store/AuthContext';
import { resolveVariables, resolveOverrides } from '../../utils/VariableResolver';
import FormRenderer from '../../components/FormRenderer';
import { getForm } from '../../api/forms';
import { submitFormData } from '../../api/data';
import { useAsyncAction } from '../../hooks/useAsyncAction';

const { Title, Text } = Typography;
const { Search } = Input;

const TeamWorkspaceDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentOrganization, organizations, switchToOrganization, hasPermission } = useOrg();

  const [apps, setApps] = useState([]);
  const [allApps, setAllApps] = useState([]);
  const [recentApps, setRecentApps] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [orgWidgets, setOrgWidgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [favoriteLoading, setFavoriteLoading] = useState({});
  const [dashboardLayoutComponents, setDashboardLayoutComponents] = useState([]);

  const [activeWidget, setActiveWidget] = useState(null);
  const [widgetForm, setWidgetForm] = useState(null);
  const [isWidgetDrawerOpen, setIsWidgetDrawerOpen] = useState(false);
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);
  const [widgetLoading, setWidgetLoading] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewEditModalOpen, setIsViewEditModalOpen] = useState(false);

  const [editingApp, setEditingApp] = useState(null);
  const [deletingAppId, setDeletingAppId] = useState(null);

  const navigate = useNavigate();

  const personalOrg = organizations?.find(
    (org) => org.type === 'PERSONAL' || org.organization?.type === 'PERSONAL',
  );

  const handleSwitchToPersonal = () => {
    if (personalOrg) {
      const orgId = personalOrg.id || personalOrg.organization?.id || personalOrg.organization?._id;
      const orgName = personalOrg.name || personalOrg.organization?.name;

      Modal.confirm({
        title: t('organization.switchConfirmTitle'),
        content: t('organization.switchConfirmContent', { name: orgName }),
        okText: t('common.confirm'),
        cancelText: t('common.cancel'),
        onOk: async () => {
          try {
            const hide = message.loading(t('organization.switching'), 0);
            await switchToOrganization(orgId);
            hide();
            message.success(t('organization.switchedSuccess'));
            window.location.href = '/';
          } catch (err) {
            message.error(t('organization.switchFailed'));
          }
        },
      });
    }
  };

  useEffect(() => {
    if (currentOrganization == null) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const appsData = await getApps();
        if (cancelled) return;
        setAllApps(appsData);
        setApps(appsData);
        const summary = await getDashboardSummary();
        if (cancelled) return;
        if (summary) {
          setRecentApps(summary.recentApps || []);
          setFavorites(summary.favorites || []);
          setDashboardLayoutComponents(summary.dashboardView || []);
          setOrgWidgets(summary.orgWidgets || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(t('dashboard.loadFailed'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [t, currentOrganization]);

  const handleToggleFavorite = async (appId, favorite) => {
    if (favoriteLoading[appId]) return;
    try {
      setFavoriteLoading((prev) => ({ ...prev, [appId]: true }));
      await apiToggleFavorite({ appId, favorite });
      const summary = await getDashboardSummary();
      if (summary) {
        setFavorites(summary.favorites || []);
      }
    } catch (err) {
      console.error('toggle favorite failed', err);
      message.error(t('common.failed'));
    } finally {
      setFavoriteLoading((prev) => ({ ...prev, [appId]: false }));
    }
  };

  const handleSearch = (value) => {
    if (value) {
      const filtered = allApps.filter((app) =>
        app.name.toLowerCase().includes(value.toLowerCase()),
      );
      setApps(filtered);
    } else {
      setApps(allApps);
    }
  };

  const handleAppCreated = (newApp) => {
    setAllApps((prev) => [newApp, ...prev]);
    setApps((prev) => [newApp, ...prev]);
  };

  const handleAppUpdated = (updatedApp) => {
    setAllApps((prev) => prev.map((app) => (app.id === updatedApp.id ? updatedApp : app)));
    setApps((prev) => prev.map((app) => (app.id === updatedApp.id ? updatedApp : app)));
  };

  const handleDelete = (appId) => {
    setDeletingAppId(appId);
    setIsDeleteModalOpen(true);
  };

  const [handleConfirmDelete, deleteConfirmLoading] = useAsyncAction(async () => {
    try {
      await deleteApp(deletingAppId);
      setAllApps((prev) => prev.filter((app) => app.id !== deletingAppId));
      setApps((prev) => prev.filter((app) => app.id !== deletingAppId));
      message.success(t('dashboard.appDeletedSuccess'));
      setIsDeleteModalOpen(false);
    } catch (err) {
      message.error(err.message || t('dashboard.appDeletedFailed'));
    }
  });

  const handleEdit = (app) => {
    setEditingApp(app);
    setIsEditModalOpen(true);
  };

  const handleWidgetClick = async (widget) => {
    if (widget.type === 'link') {
      if (widget.config?.url) {
        window.open(widget.config.url, '_blank');
      } else {
        message.warning('该挂件未配置跳转链接');
      }
      return;
    }

    if (widget.type !== 'form') return;
    try {
      setWidgetLoading(true);
      setActiveWidget(widget);
      const form = await getForm(widget.config.appId, widget.config.formId);
      setWidgetForm(form);

      const displayStyle = widget.config?.displayStyle || 'drawer';
      if (displayStyle === 'modal') {
        setIsWidgetModalOpen(true);
      } else {
        setIsWidgetDrawerOpen(true);
      }
    } catch (err) {
      message.error(t('dashboard.loadFormFailed') || '加载表单失败');
    } finally {
      setWidgetLoading(false);
    }
  };

  const [handleWidgetSubmit, isSubmittingWidget] = useAsyncAction(async (values) => {
    try {
      await submitFormData(widgetForm.id, values);
      message.success(t('dashboard.submitSuccess') || '提交成功');
      setIsWidgetDrawerOpen(false);
      setIsWidgetModalOpen(false);
    } catch (err) {
      message.error(err.message || t('dashboard.submitFailed') || '提交失败');
      throw err;
    }
  });

  const [handleSaveDashboardView, dashboardSaveLoading] = useAsyncAction(async (newLayout) => {
    try {
      await setDashboardView(newLayout);
      setDashboardLayoutComponents(newLayout);
      message.success(t('common.success'));
    } catch (err) {
      message.error(t('common.failed'));
    }
  });

  const ShortcutItem = ({ item }) => {
    const Icon = AntdIcons[item.icon] || AntdIcons.FileTextOutlined || AntdIcons.FolderOutlined;
    const handleClick = () => {
      const targetId = item.id;
      navigate(`/apps/${targetId}`, { state: { appName: item.name } });
    };
    return (
      <div
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 12px',
          cursor: 'pointer',
          borderRadius: 8,
          background: '#f8fafc',
          border: '1px solid #edf2f7',
          transition: 'all 0.2s',
          minWidth: 160,
          maxWidth: 240,
        }}
        className="shortcut-item-hover"
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            background: item.iconColor || '#1890ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon style={{ color: '#fff', fontSize: 16 }} />
        </div>
        <div
          style={{
            fontSize: 14,
            color: '#334155',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.name}
        </div>
      </div>
    );
  };

  const OrgWidgetItem = ({ widget }) => {
    const Icon = AntdIcons[widget.icon] || AntdIcons.StarOutlined;
    return (
      <Card
        hoverable
        onClick={() => handleWidgetClick(widget)}
        styles={{ body: { padding: '12px 16px' } }}
        style={{ borderRadius: 8, border: '1px solid #f0f0f0', minWidth: 160 }}
      >
        <Space>
          <div
            style={{
              width: 32,
              height: 32,
              background: '#f0f7ff',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon style={{ color: '#1890ff', fontSize: 16 }} />
          </div>
          <Text strong style={{ fontSize: 14 }}>
            {widget.title}
          </Text>
        </Space>
      </Card>
    );
  };

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <PageHeader
        title={
          <Space size={12}>
            {currentOrganization?.logo && (
              <img
                src={currentOrganization.logo}
                alt="Logo"
                style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }}
              />
            )}
            <span style={{ fontWeight: 600 }}>
              {currentOrganization?.name || t('dashboard.welcome')}
            </span>
          </Space>
        }
        extra={
          personalOrg && (
            <Button
              icon={<UserOutlined />}
              onClick={handleSwitchToPersonal}
              style={{ borderRadius: 6, fontWeight: 500 }}
            >
              {t('common.switchToPersonal') || '切换到个人空间'}
            </Button>
          )
        }
        showUser={true}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      />
      <Layout.Content
        style={{
          padding: '24px',
          overflowY: 'auto',
          maxWidth: 1280,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <div style={{ margin: '0 auto' }}>
          {/* Org Widgets Section */}
          {orgWidgets && orgWidgets.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <Space wrap size={12}>
                {orgWidgets.map((w) => (
                  <OrgWidgetItem key={w.id} widget={w} />
                ))}
              </Space>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Recently Used */}
              <Card
                variant={false}
                style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                title={
                  <Space>
                    <HistoryOutlined style={{ color: '#00b96b' }} />
                    <span>{t('dashboard.recentlyUsed')}</span>
                  </Space>
                }
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {recentApps && recentApps.length > 0 ? (
                    recentApps.map((app) => <ShortcutItem key={`recent-${app.id}`} item={app} />)
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <Text type="secondary">{t('dashboard.noRecentlyUsedDesc')}</Text>
                      }
                      style={{ margin: '12px auto' }}
                    />
                  )}
                </div>
              </Card>

              {/* Favorites */}
              <Card
                variant={false}
                style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                title={
                  <Space>
                    <StarOutlined style={{ color: '#faad14' }} />
                    <span>{t('dashboard.myFavorites')}</span>
                  </Space>
                }
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {favorites && favorites.length > 0 ? (
                    favorites
                      .slice(0, 10)
                      .map((app) => <ShortcutItem key={`star-${app.id}`} item={app} />)
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <Text type="secondary">{t('dashboard.noFavoriteAppsDesc')}</Text>
                      }
                      style={{ margin: '12px auto' }}
                    />
                  )}
                </div>
              </Card>

              {/* Dashboard View */}
              <Card
                variant={false}
                style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                title={
                  <Space>
                    <DashboardOutlined style={{ color: '#1890ff' }} />
                    <span>{t('dashboard.myViews')}</span>
                  </Space>
                }
                extra={
                  <Button
                    type="text"
                    icon={<SettingOutlined />}
                    onClick={() => setIsViewEditModalOpen(true)}
                  >
                    {t('common.edit')}
                  </Button>
                }
              >
                {dashboardLayoutComponents && dashboardLayoutComponents.length > 0 ? (
                  <ViewDisplay
                    view={{ layout: dashboardLayoutComponents }}
                    readonly={true}
                    showActions={false}
                    showSettings={false}
                    showHeader={false}
                  />
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <Space orientation="vertical" size={0}>
                        <Text type="secondary">{t('dashboard.noCustomViewDescription')}</Text>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => setIsViewEditModalOpen(true)}
                        >
                          {t('dashboard.clickToConfigure')}
                        </Button>
                      </Space>
                    }
                    style={{ margin: '12px auto' }}
                  />
                )}
              </Card>
            </div>
          </div>

          {/* Applications Area */}
          <Card
            variant={false}
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            title={
              <Space>
                <AppstoreOutlined style={{ color: '#00b96b' }} />
                <Title level={4} style={{ margin: 0 }}>
                  {t('dashboard.myApplications')}
                </Title>
              </Space>
            }
            extra={
              <Space size="middle">
                <Search
                  placeholder={t('dashboard.searchAppPlaceholder')}
                  style={{ width: 240 }}
                  onChange={(e) => handleSearch(e.target.value)}
                  allowClear
                />
                <Permission require="APP_CREATE" scope="org">
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setIsCreateModalOpen(true)}
                    style={{ borderRadius: 6 }}
                  >
                    {t('dashboard.newApplication')}
                  </Button>
                </Permission>
              </Space>
            }
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: '100px 0' }}>
                <Spin size="large" />
              </div>
            ) : error ? (
              <Alert message={error} type="error" showIcon />
            ) : (
              <Row gutter={[20, 20]}>
                {apps.map((app) => (
                  <Col xs={12} sm={8} md={6} lg={4} xl={4} key={app.id}>
                    <AppCard
                      app={app}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                      isFavorite={Boolean(favorites.find((f) => f.id === app.id))}
                      onToggleFavorite={handleToggleFavorite}
                      loading={favoriteLoading[app.id]}
                    />
                  </Col>
                ))}
                {apps.length === 0 && (
                  <Col span={24}>
                    <Empty
                      description={t('dashboard.noApplications')}
                      style={{ margin: '40px 0' }}
                    />
                  </Col>
                )}
              </Row>
            )}
          </Card>

          <CreateAppModal
            open={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onAppCreated={handleAppCreated}
          />

          {editingApp && (
            <EditAppModal
              open={isEditModalOpen}
              onClose={() => {
                setIsEditModalOpen(false);
                setEditingApp(null);
              }}
              onAppUpdated={handleAppUpdated}
              appToEdit={editingApp}
            />
          )}

          <DeleteAppModal
            open={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleConfirmDelete}
            confirmLoading={deleteConfirmLoading}
          />

          <DashboardViewEditModal
            open={isViewEditModalOpen}
            onClose={() => setIsViewEditModalOpen(false)}
            dashboardLayoutComponents={dashboardLayoutComponents}
            onSave={handleSaveDashboardView}
          />

          <Drawer
            title={activeWidget?.title}
            open={isWidgetDrawerOpen}
            onClose={() => {
              setIsWidgetDrawerOpen(false);
              setActiveWidget(null);
              setWidgetForm(null);
            }}
            size={600}
            destroyOnHidden
          >
            {widgetForm && (
              <FormRenderer
                form={widgetForm}
                onSubmit={handleWidgetSubmit}
                loading={isSubmittingWidget}
                initialValues={resolveVariables(activeWidget.config?.prefillMapping, {
                  user,
                  organization: currentOrganization,
                })}
                overrides={resolveOverrides(activeWidget.config?.prefillMapping)}
                showTitle={false}
              />
            )}
          </Drawer>

          <Modal
            title={activeWidget?.title}
            open={isWidgetModalOpen}
            onCancel={() => {
              setIsWidgetModalOpen(false);
              setActiveWidget(null);
              setWidgetForm(null);
            }}
            centered
            width={700}
            footer={null}
            destroyOnHidden
            styles={{
              body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', padding: '16px 24px' },
            }}
          >
            {widgetForm && (
              <FormRenderer
                form={widgetForm}
                onSubmit={handleWidgetSubmit}
                loading={isSubmittingWidget}
                initialValues={resolveVariables(activeWidget.config?.prefillMapping, {
                  user,
                  organization: currentOrganization,
                })}
                overrides={resolveOverrides(activeWidget.config?.prefillMapping)}
                showTitle={false}
              />
            )}
          </Modal>
        </div>
      </Layout.Content>
    </Layout>
  );
};

export default TeamWorkspaceDashboard;
