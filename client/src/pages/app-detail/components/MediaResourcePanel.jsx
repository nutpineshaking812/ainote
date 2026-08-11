import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Typography, Empty, Space, Tag, Spin, message, Modal, Button } from 'antd';
import {
  AudioOutlined,
  VideoCameraOutlined,
  DownloadOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { getFileMeta } from '../../../api/files';
import { useAppResources } from '../context/AppResourcesContext';
import { useResourceTree } from '../../../features/resource-tree/context/ResourceTreeContext.jsx';
import ResourcePanelHeader from './ResourcePanelHeader';
import { getResourceIcon } from '../../../features/resource-tree/utils/resourceIcons';
import EditableTitle from '../../../components/common/EditableTitle';
import Permission from '../../../components/Permission';
import { APP_PERMISSIONS } from '../../../constants/permissions';
import resourceEventBus from '../utils/resourceEventBus';

const { Title, Text, Paragraph } = Typography;

/**
 * A panel to display and play media resources (mp3, mp4)
 */
const MediaResourcePanel = ({ resource, onAfterDelete }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { rawResources, siderCollapsed, setSiderCollapsed, appName, updateResourceMeta, deleteResource } = useAppResources();
  const { getBreadcrumbById } = useResourceTree();

  const [loading, setLoading] = useState(true);
  const [fileData, setFileData] = useState(null);

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
      title: '删除媒体文件',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除该媒体文件吗？此操作不可恢复。',
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

  useEffect(() => {
    const fetchMeta = async () => {
      const refId = resource?.refId;
      if (!refId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const response = await getFileMeta(refId);
        if (response?.downloadUrl) {
          setFileData(response);
        }
      } catch (err) {
        console.error('Failed to fetch media meta', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMeta();
  }, [resource?.refId]);

  const breadcrumb = useMemo(() => {
    const targetId = resource?._id || resource?.id;
    try {
      return getBreadcrumbById?.(targetId) || [];
    } catch (_) {
      return [];
    }
  }, [getBreadcrumbById, resource?._id, resource?.id]);

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
      },
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
          },
        });
      });
    } else {
      items.push({
        key: 'current-node',
        title: resource?.meta?.name || '未命名',
      });
    }
    
    return items;
  }, [appName, breadcrumb, navigate, location.pathname, rawResources, resource?.meta?.name]);

  if (!resource) return <Empty />;

  const { type, meta, refId } = resource;
  const isVideo = type === 'video' || type === 'mp4';
  const isAudio = type === 'audio' || type === 'mp3';
  
  // Use the direct download URL from metadata if available
  const fileUrl = fileData?.downloadUrl || `/api/v1/files/download/${refId}`;

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin tip="Loading media..." />
      </div>
    );
  }

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
        <div style={{ padding: '32px 40px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
          {/* Header Area */}
          <div
            style={{
              marginBottom: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <Space direction="vertical" size={4}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <EditableTitle 
                  value={meta?.name}
                  onSave={handleUpdateName}
                  level={3}
                />
                <a href={fileUrl} target="_blank" rel="noopener noreferrer" download>
                  <DownloadOutlined
                    style={{
                      fontSize: '18px',
                      color: '#8c8c8c',
                      cursor: 'pointer',
                      marginTop: '4px',
                    }}
                  />
                </a>
              </div>
              <Space>
                <Tag color="blue" icon={isVideo ? <VideoCameraOutlined /> : <AudioOutlined />}>
                  {type.toUpperCase()}
                </Tag>
                {fileData?.file?.name && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {t('common.originalFile', '原始文件')}: {fileData.file.name}
                  </Text>
                )}
              </Space>
            </Space>
          </div>

          {/* Media Player Area */}
          <div
            style={{
              background: '#000',
              borderRadius: '8px',
              overflow: 'hidden',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: isVideo ? '400px' : 'auto',
              padding: isAudio ? '40px 20px' : '0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            {isVideo ? (
              <video
                controls
                style={{ width: '100%', maxHeight: '70vh', outline: 'none' }}
                src={fileUrl}
              >
                Your browser does not support the video tag.
              </video>
            ) : isAudio ? (
              <div style={{ width: '100%', maxWidth: '600px', textAlign: 'center' }}>
                <div style={{ marginBottom: '20px' }}>
                  <AudioOutlined style={{ fontSize: '48px', color: '#fff', opacity: 0.5 }} />
                </div>
                <audio controls style={{ width: '100%' }} src={fileUrl}>
                  Your browser does not support the audio tag.
                </audio>
              </div>
            ) : (
              <Empty description="Unsupported media format" />
            )}
          </div>

          {/* Description Area */}
          {meta?.desc && (
            <div style={{ marginTop: '32px', borderTop: '1px solid #edece9', paddingTop: '24px' }}>
              <Title level={5} style={{ marginBottom: '12px', color: '#37352f' }}>
                {t('common.description') || '描述'}
              </Title>
              <Paragraph style={{ color: '#37352f', fontSize: '15px', lineHeight: 1.6 }}>
                {meta.desc}
              </Paragraph>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaResourcePanel;
