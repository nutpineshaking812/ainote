import React, { useEffect, useState } from 'react';
import {
  Button,
  Space,
  Spin,
  Typography,
  Divider,
  message,
  Card,
  Modal,
  Tooltip,
  Popconfirm,
} from 'antd';
import {
  EditOutlined,
  PieChartOutlined,
  BarChartOutlined,
  LineChartOutlined,
  AreaChartOutlined,
  DotChartOutlined,
  TableOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { getView } from '../../../api/views';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { addLayoutComponent } from '../../../api/dashboard';
import { v4 as uuidv4 } from 'uuid';

import UserAvatarDropdown from '../../../components/UserAvatarDropdown';
import ViewDisplay from '../../../components/ViewDisplay.jsx';
import resourceEventBus from '../../../pages/app-detail/utils/resourceEventBus';
import { useAppResources } from '../../../pages/app-detail/context/AppResourcesContext.jsx';
import Permission from '../../../components/Permission';
import ResourcePanelHeader from '../../../pages/app-detail/components/ResourcePanelHeader';
import PermissionGuard from '../../../components/PermissionGuard';
import { APP_PERMISSIONS } from '../../../constants/permissions';
import EmptyPage from '../../../components/EmptyPage';

const { Text } = Typography;
import '../../../components/ResourcePanel.css';

export default function ViewResourcePanel({ appId, resource }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { siderCollapsed, setSiderCollapsed, hasAppPermission, deleteResource } = useAppResources();
  const [viewDetails, setViewDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  const canViewView = hasAppPermission(APP_PERMISSIONS.VIEW_VIEW);

  // Load view details when resource changes
  // resource.id is refId (View._id)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!resource || resource.type !== 'view' || !canViewView) {
        setViewDetails(null);
        return;
      }
      try {
        setLoading(true);
        // Use original API with refId
        const view = await getView(appId, resource.id);
        if (cancelled) return;
        setViewDetails(view);
      } catch (e) {
        if (!cancelled) {
          setViewDetails(null);
          message.error(t('viewResourcePanel.loadFailed'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [resource, canViewView, t, appId]);

  const handleDelete = async () => {
    if (!resource) return;
    Modal.confirm({
      title: t('viewResourcePanel.deleteViewTitle'),
      icon: <ExclamationCircleOutlined />,
      content: t('viewResourcePanel.deleteViewContent'),
      okType: 'danger',
      okText: t('viewResourcePanel.delete'),
      cancelText: t('viewResourcePanel.cancel'),
      onOk: async () => {
        try {
          const success = await deleteResource('view', resource._id || resource.id);
          if (success) {
            // 通知树移除节点，视图删除清空hash
            resourceEventBus.emit('resource:deleted', {
              type: 'view',
              id: resource.id,
              navigateTo: 'clear',
            });
          }
        } catch {
          message.error(t('viewResourcePanel.deleteFailed'));
        }
      },
    });
  };

  // --- NEW FUNCTION: handleAddLayoutComponent ---
  const handleAddLayoutComponent = async (layoutItem, sourceView) => {
    try {
      const newLayoutComponent = {
        layoutId: uuidv4(),
        owner: sourceView.owner,
        appId: appId,
        viewId: sourceView._id,
        componentId: layoutItem.componentId,
        locked: layoutItem.locked || false,
        x: layoutItem.x,
        y: layoutItem.y,
        w: layoutItem.w,
        h: layoutItem.h,
        z: layoutItem.z || 0,
      };

      // Call the new API to add the layout component
      await addLayoutComponent(newLayoutComponent);
      message.success(t('viewResourcePanel.addedToDashboardSuccess'));

      // Optionally, emit an event to refresh the dashboard display if it's in another component
      resourceEventBus.emit('dashboard:refresh');
    } catch (error) {
      console.error('Failed to add component to dashboard:', error);
      message.error(t('viewResourcePanel.addedToDashboardFailed'));
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      <ResourcePanelHeader
        breadcrumbItems={[{ title: t('viewResourcePanel.view') }]}
        siderCollapsed={siderCollapsed}
        setSiderCollapsed={setSiderCollapsed}
        extraActions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Permission require={APP_PERMISSIONS.VIEW_DESIGN} scope="app">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined style={{ fontSize: '15px' }} />}
                disabled={!viewDetails}
                onClick={() => navigate(`/apps/${appId}/views/${resource.id}#/edit`)}
              >
                {t('viewResourcePanel.edit')}
              </Button>
            </Permission>

            <Permission require={APP_PERMISSIONS.VIEW_DESIGN} scope="app">
              <Button
                type="text"
                size="small"
                danger
                style={{ color: '#ff4d4f' }}
                icon={<DeleteOutlined style={{ fontSize: '15px' }} />}
                disabled={!viewDetails}
                onClick={handleDelete}
              >
                {t('viewResourcePanel.delete')}
              </Button>
            </Permission>
          </div>
        }
      />

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <PermissionGuard
          require={APP_PERMISSIONS.VIEW_VIEW}
          fallback={<EmptyPage description="你没有查看此视图的权限" />}
        >
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spin size="large" />
            </div>
          ) : viewDetails ? (
            <div style={{ padding: '0 24px 60px 24px', width: '100%' }}>
              <Typography.Title
                level={1}
                style={{
                  marginBottom: 32,
                  fontSize: '32px',
                  fontWeight: 700,
                  color: '#37352f',
                  letterSpacing: '-0.01em',
                }}
              >
                {viewDetails.name}
              </Typography.Title>
              <ViewDisplay view={viewDetails} onAddToDashboard={handleAddLayoutComponent} />
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#888', marginTop: 80 }}>
              {t('viewResourcePanel.selectOrCreateView')}
            </div>
          )}
        </PermissionGuard>
      </div>
    </div>
  );
}
