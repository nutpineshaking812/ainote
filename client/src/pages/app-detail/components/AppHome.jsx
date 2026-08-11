import React, { useMemo, useEffect, useState } from 'react';
import {
  Typography,
  Row,
  Col,
  Card,
  Space,
  Spin,
  Empty,
  Button,
  Divider,
  List,
  Modal,
  message,
  Avatar,
  Tag,
} from 'antd';
import {
  FileTextOutlined,
  FormOutlined,
  PieChartOutlined,
  NodeIndexOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  PlayCircleOutlined,
  PlusCircleOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAppResources } from '../context/AppResourcesContext';
import useAppStore from '../../../store/useAppStore';
import { getWorkflows } from '../../../api/workflow';
import UserAvatarDropdown from '../../../components/UserAvatarDropdown';
import OrganizationSwitchModal from '../../../components/OrganizationSwitchModal';
import { useOrg } from '../../../store/OrgContext';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const AppHome = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const appId = useAppStore((state) => state.currentAppId);
  const { currentOrganization, organizations, switchToOrganization } = useOrg();
  const { rawResources, loadingResources, appName } = useAppResources();
  const [workflows, setWorkflows] = useState([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [showOrgModal, setShowOrgModal] = useState(false);

  // Fetch workflow history
  useEffect(() => {
    const fetchWorkflowHistory = async () => {
      if (!appId) return;
      setLoadingWorkflows(true);
      try {
        const response = await getWorkflows({ appId, limit: 3 });
        // The interceptor in api/index.js already returns response.data.data (the array)
        setWorkflows(Array.isArray(response) ? response : response?.data || []);
      } catch (err) {
        console.error('Failed to fetch workflows', err);
      } finally {
        setLoadingWorkflows(false);
      }
    };

    fetchWorkflowHistory();
  }, [appId]);

  // Derive recent resources
  const recentResources = useMemo(() => {
    return [...(rawResources || [])]
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
      .slice(0, 6);
  }, [rawResources]);

  const getIcon = (type, size = 20) => {
    switch (type) {
      case 'form':
        return <FormOutlined style={{ color: '#2383e2', fontSize: size }} />;
      case 'view':
        return <PieChartOutlined style={{ color: '#0b6e99', fontSize: size }} />;
      case 'document':
        return <FileTextOutlined style={{ color: '#37352f', fontSize: size }} />;
      default:
        return <FileTextOutlined style={{ fontSize: size }} />;
    }
  };

  const handleResourceClick = (resource) => {
    navigate(`/apps/${appId}#/${resource.type}/${resource.refId || resource.id}`);
  };

  const teamOrgs =
    organizations?.filter(
      (org) =>
        org.id !== currentOrganization?.id &&
        org.type !== 'PERSONAL' &&
        org.organization?.type !== 'PERSONAL',
    ) || [];

  const handleSwitchToTeam = () => {
    if (teamOrgs.length === 1) {
      const org = teamOrgs[0];
      const orgId = org.id || org.organization?.id || org.organization?._id;
      const orgName = org.name || org.organization?.name;

      Modal.confirm({
        title: t('organization.switchConfirmTitle'),
        content: t('organization.switchConfirmContent', { name: orgName }),
        okText: t('common.confirm'),
        cancelText: t('common.cancel'),
        onOk: async () => {
          try {
            await switchToOrganization(orgId);
            window.location.href = '/';
          } catch (err) {
            console.error('Switch organization failed', err);
          }
        },
      });
    } else {
      setShowOrgModal(true);
    }
  };

  const handleCreateNew = (type) => {
    if (type === 'form') navigate({ pathname: `/apps/${appId}/forms/new`, hash: '#/edit' });
    else if (type === 'view') navigate(`/apps/${appId}/views/new`);
  };

  const handleWorkflowClick = (workflow) => {
    navigate(`/apps/${appId}/workflows/${workflow.id}`);
  };

  const appNameShort = useMemo(() => {
    if (!appName) return '';
    return appName.slice(0, 1).toUpperCase();
  }, [appName]);

  const appColor = useMemo(() => {
    if (!appName) return '#37352f';
    const colors = [
      'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
      'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
      'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
    ];
    let hash = 0;
    for (let i = 0; i < appName.length; i++) {
      hash = appName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }, [appName]);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#fdfdfc' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
        {/* Header Section */}
        <div
          style={{
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                background: appColor,
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                color: '#fff',
                fontSize: '20px',
                fontWeight: 700,
                flexShrink: 0,
                textShadow: '0 1px 2px rgba(0,0,0,0.2)',
              }}
            >
              {appNameShort || 'A'}
            </div>
            <div>
              <Title level={2} style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
                {appName || t('common.home')}
              </Title>
              <Text type="secondary" style={{ fontSize: '13px' }}>
                {t('appHome.welcomeDescription')}
              </Text>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {currentOrganization?.type === 'PERSONAL' && teamOrgs.length > 0 && (
              <Button
                icon={<TeamOutlined />}
                onClick={handleSwitchToTeam}
                style={{ borderRadius: '8px', fontWeight: 500 }}
              >
                {t('common.switchToOrganization') || '切换到组织空间'}
              </Button>
            )}
            <UserAvatarDropdown />
          </div>
        </div>

        <Divider style={{ marginTop: 0, marginBottom: '24px', borderColor: '#f2f2f2' }} />

        {/* Organization Switch Modal */}
        <OrganizationSwitchModal open={showOrgModal} onCancel={() => setShowOrgModal(false)} />

        <div style={{ padding: '0 8px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 280px',
              gap: '16px',
              alignItems: 'start',
            }}
          >
            {/* Left Column: Recent & History */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Section: Recently Viewed */}
              <div
                style={{
                  background: '#fff',
                  borderRadius: '16px',
                  border: '1px solid #edece9',
                  padding: '20px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px',
                  }}
                >
                  <Title
                    level={5}
                    style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#37352f' }}
                  >
                    {t('appHome.recentEdits')}
                  </Title>
                </div>

                {loadingResources ? (
                  <div style={{ padding: '20px', textAlign: 'center' }}>
                    <Spin size="small" />
                  </div>
                ) : recentResources.length > 0 ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: '12px',
                    }}
                  >
                    {recentResources.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleResourceClick(item)}
                        style={{
                          padding: '12px',
                          borderRadius: '10px',
                          border: '1px solid #f0f0f0',
                          cursor: 'pointer',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          background: '#fafafa',
                        }}
                        className="hover-item"
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '4px',
                          }}
                        >
                          {getIcon(item.type, 16)}
                          <Text
                            strong
                            style={{
                              fontSize: '13px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              flex: 1,
                            }}
                          >
                            {item.meta?.name || item.name || t('documentResourcePanel.untitled')}
                          </Text>
                        </div>
                        <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
                          {dayjs(item.updatedAt).fromNow()}
                        </Text>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('common.noData')} />
                )}
              </div>

              {/* Section: Workflow History */}
              <div
                style={{
                  background: '#fff',
                  borderRadius: '16px',
                  border: '1px solid #edece9',
                  padding: '20px',
                }}
              >
                <Title
                  level={5}
                  style={{
                    marginBottom: '20px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#37352f',
                  }}
                >
                  {t('appHome.workflowHistory')}
                </Title>
                {loadingWorkflows ? (
                  <div style={{ padding: '20px', textAlign: 'center' }}>
                    <Spin size="small" />
                  </div>
                ) : workflows.length > 0 ? (
                  <List
                    dataSource={workflows.slice(0, 5)}
                    renderItem={(item) => (
                      <List.Item
                        style={{
                          padding: '8px 4px',
                          border: 'none',
                          marginBottom: 2,
                          cursor: 'pointer',
                        }}
                        className="notion-sidebar-item"
                        onClick={() => handleWorkflowClick(item)}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                            gap: '12px',
                          }}
                        >
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: '#f5f5f5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <NodeIndexOutlined style={{ fontSize: '14px', color: '#787774' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text strong style={{ fontSize: '13px', display: 'block' }}>
                              {item.name || 'Workflow'}
                            </Text>
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              {t('common.updatedAt')}: {dayjs(item.updatedAt).fromNow()}
                            </Text>
                          </div>
                          <Tag
                            style={{
                              borderRadius: '12px',
                              border: 'none',
                              fontSize: '10px',
                              padding: '0 8px',
                              height: '20px',
                              lineHeight: '20px',
                              background: item.status === 'ACTIVE' ? '#e7f3ef' : '#f5f5f5',
                              color: item.status === 'ACTIVE' ? '#0e6245' : '#787774',
                            }}
                          >
                            {item.status}
                          </Tag>
                        </div>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t('appHome.noExecutions')}
                  />
                )}
              </div>
            </div>

            {/* Right Column: Quick Actions & Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Quick Actions Card */}
              <div
                style={{
                  background: 'linear-gradient(145deg, #2c2c2c 0%, #1a1a1a 100%)',
                  borderRadius: '16px',
                  padding: '16px',
                  color: '#fff',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                  position: 'relative',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <Title
                  level={5}
                  style={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '1.2px',
                    marginBottom: '20px',
                    fontWeight: 700,
                  }}
                >
                  {t('dashboard.quickActions')}
                </Title>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    {
                      key: 'form',
                      icon: <PlusCircleOutlined />,
                      label: t('sidebar.newForm'),
                      action: () => handleCreateNew('form'),
                    },
                    {
                      key: 'view',
                      icon: <PlusCircleOutlined />,
                      label: t('sidebar.newView'),
                      action: () => handleCreateNew('view'),
                    },
                    {
                      key: 'workflow',
                      icon: <NodeIndexOutlined />,
                      label: t('sidebar.workflows'),
                      action: () => navigate(`/apps/${appId}/workflows`),
                      color: '#a371f7',
                    },
                    {
                      key: 'settings',
                      icon: <SettingOutlined />,
                      label: t('appSettings.title'),
                      action: () => navigate(`/apps/${appId}/settings/info`),
                    },
                  ].map((action) => (
                    <div
                      key={action.key}
                      onClick={action.action}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        border: '1px solid rgba(255,255,255,0.03)',
                      }}
                      className="notion-sidebar-item-dark"
                    >
                      <span
                        style={{
                          fontSize: '16px',
                          color: action.color || 'rgba(255,255,255,0.6)',
                          display: 'flex',
                        }}
                      >
                        {action.icon}
                      </span>
                      <Text style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                        {action.label}
                      </Text>
                    </div>
                  ))}
                </div>
              </div>

              {/* App Resources Stats */}
              <div
                style={{
                  background: '#fff',
                  borderRadius: '16px',
                  border: '1px solid #edece9',
                  padding: '20px',
                }}
              >
                <Title
                  level={5}
                  style={{
                    marginBottom: '16px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#37352f',
                  }}
                >
                  {t('common.appStats') || '资源统计'}
                </Title>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Space size={8}>
                      <FormOutlined style={{ color: 'rgba(55, 53, 47, 0.45)' }} />
                      <Text style={{ fontSize: '13px', color: '#787774' }}>{t('common.form')}</Text>
                    </Space>
                    <Text strong style={{ fontSize: '13px' }}>
                      {rawResources.filter((r) => r.type === 'form').length}
                    </Text>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Space size={8}>
                      <FileTextOutlined style={{ color: 'rgba(55, 53, 47, 0.45)' }} />
                      <Text style={{ fontSize: '13px', color: '#787774' }}>
                        {t('common.document')}
                      </Text>
                    </Space>
                    <Text strong style={{ fontSize: '13px' }}>
                      {rawResources.filter((r) => r.type === 'document').length}
                    </Text>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Space size={8}>
                      <PieChartOutlined style={{ color: 'rgba(55, 53, 47, 0.45)' }} />
                      <Text style={{ fontSize: '13px', color: '#787774' }}>{t('common.view')}</Text>
                    </Space>
                    <Text strong style={{ fontSize: '13px' }}>
                      {rawResources.filter((r) => r.type === 'view').length}
                    </Text>
                  </div>
                </div>
              </div>



            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppHome;
