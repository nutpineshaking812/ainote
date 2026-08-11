import React, { useMemo, useCallback } from 'react';
import { List, Typography, Space, Card, Breadcrumb, Tooltip, message, Modal, Button } from 'antd';
import {
  FolderFilled,
  FolderOpenOutlined,
  FolderOutlined,
  RightOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { getResourceIcon } from '../../../features/resource-tree/utils/resourceIcons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppResources } from '../context/AppResourcesContext';
import { useResourceTree } from '../../../features/resource-tree/context/ResourceTreeContext.jsx';
import ResourcePanelHeader from './ResourcePanelHeader';
import EditableTitle from '../../../components/common/EditableTitle';
import Permission from '../../../components/Permission';
import { APP_PERMISSIONS } from '../../../constants/permissions';
import resourceEventBus from '../utils/resourceEventBus';

const { Text, Title } = Typography;

/**
 * Panel displayed when a Folder is selected.
 * Lists child resources in a clean, interactive list.
 */
const FolderResourcePanel = ({ resource, onAfterDelete }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { rawResources, siderCollapsed, setSiderCollapsed, appName, updateResourceMeta, deleteResource } = useAppResources();
  const { getBreadcrumbById } = useResourceTree();

  const handleUpdateName = async (newName) => {
    const res = await updateResourceMeta(resource.type, resource.refId, { name: newName });
    if (res.success) {
      message.success(t('common.updateSuccess') || '修改成功');
    } else {
      throw new Error('Update failed');
    }
  };

  const handleDelete = useCallback(async () => {
    if (!resource) return;
    Modal.confirm({
      title: '删除文件夹',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除该文件夹吗？此操作不可恢复（需先删除其子项）。',
      okType: 'danger',
      okText: t('common.delete') || '删除',
      cancelText: t('common.cancel') || '取消',
      onOk: async () => {
        try {
          const success = await deleteResource(resource.type, resource._id || resource.id);
          if (success) {
            resourceEventBus.emit('resource:deleted', {
              type: resource.type,
              id: resource.id,
              navigateTo: 'clear',
            });
            onAfterDelete?.(resource.id);
          }
        } catch (e) {
          message.error(e.message || t('common.deleteFailed') || '删除失败');
        }
      },
    });
  }, [resource, deleteResource, onAfterDelete, t]);

  if (!resource) return null;

  // Find children of this folder
  const targetId = resource._id || resource.id;
  const children = useMemo(() => {
    return rawResources.filter((r) => r.parentId === targetId);
  }, [rawResources, targetId]);

  const breadcrumb = useMemo(() => {
    try {
      return getBreadcrumbById?.(targetId) || [];
    } catch (_) {
      return [];
    }
  }, [getBreadcrumbById, targetId]);

  const stats = useMemo(() => {
    const counts = { folder: 0, form: 0, view: 0, document: 0 };
    children.forEach((c) => {
      if (counts[c.type] !== undefined) counts[c.type]++;
    });
    return counts;
  }, [children]);

  const getIcon = (item, large = false) => {
    const isContainer = rawResources.some((r) => r.parentId === item.id);
    return getResourceIcon(item.type, {
      isContainer,
      large,
      isSkill: item.meta?.isSkill,
      isKnowledge: item.meta?.isKnowledge || item.meta?.purpose === 'KNOWLEDGE',
    });
  };

  const handleItemClick = (item) => {
    const hash = `#/${item.type}/${item.refId || item.id}`;
    navigate({ pathname: location.pathname, hash });
  };

  const breadcrumbItems = useMemo(() => {
    const items = [];
    
    // 1. Add App Name as Root
    items.push({
      key: 'app-root',
      title: appName || 'App',
      className: 'breadcrumb-link',
      onClick: (e) => {
        e.preventDefault();
        navigate({ pathname: location.pathname, hash: '' });
      }
    });

    // 2. Add path nodes
    if (Array.isArray(breadcrumb) && breadcrumb.length > 0) {
      breadcrumb.forEach((b, idx) => {
        const isLast = idx === breadcrumb.length - 1;
        items.push({
          key: b.id || `crumb-${idx}`,
          title: b.title || '未命名',
          className: isLast ? '' : 'breadcrumb-link',
          onClick: (e) => {
            if (isLast) return;
            e.preventDefault();
            const res = rawResources.find((r) => r.id === b.id || r.refId === b.id);
            if (res) {
              const hash = `#/${res.type}/${res.refId || res.id}`;
              navigate({ pathname: location.pathname, hash });
            }
          }
        });
      });
    } else {
      // Fallback: If tree path lookup fails, at least show the current folder
      items.push({
        key: 'current-node',
        title: resource.meta?.name || '未命名',
      });
    }
    
    return items;
  }, [appName, breadcrumb, navigate, location.pathname, rawResources, resource.meta?.name]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <ResourcePanelHeader
        breadcrumbItems={breadcrumbItems}
        siderCollapsed={siderCollapsed}
        setSiderCollapsed={setSiderCollapsed}
        extraActions={
          <Permission require={APP_PERMISSIONS.DOC_MANAGE} scope="app">
            <Button
              danger
              type="text"
              icon={<DeleteOutlined />}
              onClick={handleDelete}
              size="small"
              style={{ color: '#ff4d4f' }}
            >
              {t('common.delete') || '删除'}
            </Button>
          </Permission>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 40px' }}>
          {/* Header Area */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div style={{ 
              width: '48px', 
              height: '48px', 
              background: '#f7f7f5', 
              borderRadius: '12px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '24px',
              flexShrink: 0
            }}>
              {getResourceIcon('folder', { large: true })}
            </div>
            <div style={{ flex: 1 }}>
              <Space direction="vertical" size={0}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                  {breadcrumb.slice(0, -1).map((b, i) => (
                    <React.Fragment key={b.id || i}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>{b.title}</Text>
                      <RightOutlined style={{ fontSize: '10px', color: 'rgba(0,0,0,0.2)' }} />
                    </React.Fragment>
                  ))}
                  <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('common.folder', 'FOLDER')}
                  </Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                  <EditableTitle
                    value={resource.meta?.name || '未命名文件夹'}
                    onSave={handleUpdateName}
                    level={3}
                    style={{ margin: 0, fontWeight: 700, color: '#37352f' }}
                  />
                  <Text type="secondary" style={{ fontSize: '12px', opacity: 0.6 }}>
                    ({children.length} {t('common.items', '个资源')})
                  </Text>
                </div>
              </Space>
            </div>
          </div>

          {/* Children List */}
          <div>
            <div style={{ 
              padding: '0 8px 8px 8px', 
              borderBottom: '1px solid #edece9', 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '4px'
            }}>
              <Text strong style={{ fontSize: '12px', color: 'rgba(55, 53, 47, 0.45)', textTransform: 'uppercase' }}>
                {t('common.contents', '文件夹内容')}
              </Text>
            </div>

            <List
              dataSource={children}
              locale={{ emptyText: (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <div style={{ marginBottom: '8px' }}>
                    {getResourceIcon('folder', { large: true, color: '#edece9' })}
                  </div>
                  <p style={{ color: 'rgba(55, 53, 47, 0.4)', fontSize: '13px' }}>{t('common.emptyFolder', '暂无资源')}</p>
                </div>
              )}}
              renderItem={(item) => (
                <div
                  onClick={() => handleItemClick(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    margin: '2px 0',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f7f7f5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ width: '24px', display: 'flex', justifyContent: 'center' }}>
                    {getIcon(item)}
                  </div>
                  <div style={{ flex: 1, marginLeft: '8px' }}>
                    <Text style={{ fontSize: '14px', fontWeight: 500, color: '#37352f' }}>
                      {item.meta?.name || '未命名'}
                    </Text>
                  </div>
                  <RightOutlined style={{ fontSize: '10px', color: 'rgba(55, 53, 47, 0.2)' }} />
                </div>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FolderResourcePanel;
