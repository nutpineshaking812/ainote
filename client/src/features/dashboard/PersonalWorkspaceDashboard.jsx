import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Typography,
  Space,
  Empty,
  Spin,
  Button,
  Row,
  Col,
  Tooltip,
  Tag,
  Input,
  Layout,
} from 'antd';
import PageHeader from '../../components/PageHeader';
import {
  FileTextOutlined,
  PlusOutlined,
  EditOutlined,
  ClockCircleOutlined,
  StarOutlined,
  AppstoreOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { recentDocuments } from '../../api/documents';
import { getApps } from '../../api/apps';
import { getDashboardSummary, toggleFavorite as apiToggleFavorite } from '../../api/dashboard';
import { useAuth } from '../../store/AuthContext';
import { useOrg } from '../../store/OrgContext';
import CreateAppModal from './CreateAppModal';
import * as AntdIcons from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

// ─── Greeting ────────────────────────────────────────────────────────────────
function buildGreeting(nickname) {
  const hour = new Date().getHours();
  if (hour < 5) return `夜深了，${nickname} 🌙`;
  if (hour < 9) return `早上好，${nickname} ☀️`;
  if (hour < 12) return `上午好，${nickname} 🌤️`;
  if (hour < 14) return `中午好，${nickname} 🍜`;
  if (hour < 18) return `下午好，${nickname} ☕`;
  return `晚上好，${nickname} 🌇`;
}

// ─── Recent Document Card ────────────────────────────────────────────────────
function RecentDocCard({ doc, onClick }) {
  return (
    <Card
      hoverable
      onClick={() => onClick(doc)}
      style={{ borderRadius: 12, border: '1px solid #f0f0f0', cursor: 'pointer' }}
      styles={{ body: { padding: '16px' } }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={6}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <FileTextOutlined
            style={{ fontSize: 20, color: '#00b96b', flexShrink: 0, marginTop: 2 }}
          />
          <Text
            strong
            style={{
              fontSize: 14,
              lineHeight: '22px',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              flex: 1,
            }}
          >
            {doc.title || '未命名笔记'}
          </Text>
        </div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          {dayjs(doc.updatedAt).fromNow()}
        </Text>
      </Space>
    </Card>
  );
}

// ─── App Quick-entry Card ─────────────────────────────────────────────────────
function AppQuickCard({ app, isFavorite, onToggleFavorite, onClick }) {
  const Icon = AntdIcons[app.icon] || AntdIcons.AppstoreOutlined;
  return (
    <Card
      hoverable
      onClick={() => onClick(app)}
      style={{ borderRadius: 12, border: '1px solid #f0f0f0', cursor: 'pointer' }}
      styles={{ body: { padding: '14px 16px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: app.iconColor || '#1890ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon style={{ color: '#fff', fontSize: 17 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text
            strong
            style={{
              fontSize: 14,
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {app.name}
          </Text>
          {app.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {app.description.slice(0, 30)}
              {app.description.length > 30 ? '…' : ''}
            </Text>
          )}
        </div>
        <Tooltip title={isFavorite ? '取消星标' : '星标'}>
          <StarOutlined
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(app.id, !isFavorite);
            }}
            style={{
              color: isFavorite ? '#faad14' : '#d9d9d9',
              fontSize: 16,
              cursor: 'pointer',
              transition: 'color 0.2s',
            }}
          />
        </Tooltip>
      </div>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PersonalWorkspaceDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrganization } = useOrg();

  const [recentDocs, setRecentDocs] = useState([]);
  const [apps, setApps] = useState([]);
  const [allApps, setAllApps] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favoriteLoading, setFavoriteLoading] = useState({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const nickname = user?.nickname || user?.username || '朋友';
  const greeting = buildGreeting(nickname);


  // Load all data
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        // Parallel fetch app list, recent docs and summary
        let [appsData, docsData, summary] = await Promise.all([
          getApps(),
          recentDocuments({ limit: 6 }),
          getDashboardSummary(),
        ]);
        if (cancelled) return;

        setAllApps(appsData);
        setApps(appsData);
        setRecentDocs(docsData?.items || []);
        setFavorites(summary?.favorites || []);
      } catch (e) {
        console.error('PersonalWorkspaceDashboard load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization]);

  // Handle "Direct Entry" for Personal Mode: navigate to the first app if it exists
  useEffect(() => {
    if (!loading && allApps.length > 0) {
      const targetApp = allApps[0];
      navigate(`/apps/${targetApp.id}`, { replace: true, state: { appName: targetApp.name } });
    }
  }, [loading, allApps, navigate]);

  const handleSearch = useCallback(
    (value) => {
      setSearchQuery(value);
      if (value) {
        setApps(allApps.filter((a) => a.name.toLowerCase().includes(value.toLowerCase())));
      } else {
        setApps(allApps);
      }
    },
    [allApps],
  );

  const handleAppClick = (app) => {
    navigate(`/apps/${app.id}`, { state: { appName: app.name } });
  };

  const handleDocClick = (doc) => {
    // Navigate to the document — we need to find which app it belongs to through the API
    // For now, open the recent doc if we can resolve its app
    // If doc doesn't have appRef info exposed, we navigate to dashboard and let user pick
    if (doc._id) {
      // Try to find app via favorites or apps list that has this doc
      // We emit a navigation hint — docs with parentName can hint at origin app
      // Best-effort: look for an app and navigate to its detail with doc hash
      if (apps.length > 0) {
        // This is a heuristic: open the first app. In a full implementation, the API
        // would return the appId alongside recent docs.
        navigate(`/apps/${apps[0].id}#/document/${doc._id}`, { state: { appName: apps[0].name } });
      }
    }
  };

  const handleToggleFavorite = async (appId, favorite) => {
    if (favoriteLoading[appId]) return;
    try {
      setFavoriteLoading((prev) => ({ ...prev, [appId]: true }));
      await apiToggleFavorite({ appId, favorite });
      const summary = await getDashboardSummary();
      setFavorites(summary?.favorites || []);
    } catch (e) {
      console.error('toggle favorite failed', e);
    } finally {
      setFavoriteLoading((prev) => ({ ...prev, [appId]: false }));
    }
  };

  const handleAppCreated = (newApp) => {
    setAllApps((prev) => [newApp, ...prev]);
    setApps((prev) => [newApp, ...prev]);
  };

  const favoriteIds = new Set(favorites.map((f) => f.id));

  if (loading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}
      >
        <Spin size="large" />
      </div>
    );
  }

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
            <span style={{ fontWeight: 600 }}>{greeting}</span>
          </Space>
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
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 8px' }}>
          {/* ── Recent Documents ── */}
          <section style={{ marginBottom: 32 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <Space>
                <ClockCircleOutlined style={{ color: '#00b96b', fontSize: 16 }} />
                <Title level={5} style={{ margin: 0 }}>
                  最近笔记
                </Title>
              </Space>
            </div>
            {recentDocs.length > 0 ? (
              <Row gutter={[14, 14]}>
                {recentDocs.map((doc) => (
                  <Col xs={24} sm={12} md={8} key={doc._id}>
                    <RecentDocCard doc={doc} onClick={handleDocClick} />
                  </Col>
                ))}
              </Row>
            ) : (
              <Card
                style={{ borderRadius: 12, border: '1px dashed #d9d9d9' }}
                styles={{ body: { padding: '28px 0' } }}
              >
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<Text type="secondary">还没有笔记，去应用里创建一个吧</Text>}
                />
              </Card>
            )}
          </section>

          {/* ── My Apps ── */}
          <section>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <Space>
                <AppstoreOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                <Title level={5} style={{ margin: 0 }}>
                  我的应用
                </Title>
              </Space>
              <Space>
                <Search
                  size="small"
                  placeholder="搜索应用…"
                  style={{ width: 200 }}
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  allowClear
                />
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  新建应用
                </Button>
              </Space>
            </div>

            {apps.length > 0 ? (
              <Row gutter={[14, 14]}>
                {apps.map((app) => (
                  <Col xs={24} sm={12} md={8} lg={6} key={app.id}>
                    <AppQuickCard
                      app={app}
                      isFavorite={favoriteIds.has(app.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onClick={handleAppClick}
                    />
                  </Col>
                ))}
              </Row>
            ) : (
              <Card
                style={{ borderRadius: 12, border: '1px dashed #d9d9d9' }}
                styles={{ body: { padding: '40px 0' } }}
              >
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Space direction="vertical" size={2}>
                      <Text type="secondary">还没有应用</Text>
                      <Button type="link" size="small" onClick={() => setIsCreateModalOpen(true)}>
                        立即创建
                      </Button>
                    </Space>
                  }
                />
              </Card>
            )}
          </section>

          <CreateAppModal
            open={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onAppCreated={handleAppCreated}
          />
        </div>
      </Layout.Content>
    </Layout>
  );
}
