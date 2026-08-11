import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Spin, message, Button, Space, Typography, Descriptions, Tag, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  DownloadOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { getFileMeta, downloadFile } from '../../../api/files';
import { downloadAndSave } from '../../../utils/fileDownload';
import ResourcePanelHeader from './ResourcePanelHeader';
import useAppStore from '../../../store/useAppStore';
import { useResourceTree } from '../../../features/resource-tree/context/ResourceTreeContext';
import { getResourceIcon } from '../../../features/resource-tree/utils/resourceIcons';
import EditableTitle from '../../../components/common/EditableTitle';
import { useAppResources } from '../context/AppResourcesContext';
import Permission from '../../../components/Permission';
import { APP_PERMISSIONS } from '../../../constants/permissions';
import resourceEventBus from '../utils/resourceEventBus';

const { Title, Text } = Typography;

/**
 * DefaultResourcePanel - A fallback panel for unknown or generic file resources
 */
const DefaultResourcePanel = ({ appId, resource, onAfterDelete }) => {
  const { t } = useTranslation();
  const isSidebarCollapsed = useAppStore((state) => state.isSidebarCollapsed);
  const setSidebarCollapsed = useAppStore((state) => state.setSidebarCollapsed);
  const { getBreadcrumbById } = useResourceTree();
  const { updateResourceMeta, deleteResource } = useAppResources();

  const [loading, setLoading] = useState(true);
  const [fileMeta, setFileMeta] = useState(null);

  const breadcrumbItems = useMemo(() => {
    return resource?.id ? getBreadcrumbById(resource.id) : [];
  }, [resource?.id, getBreadcrumbById]);

  const handleUpdateName = async (newName) => {
    const res = await updateResourceMeta(resource.type, resource.refId, { name: newName });
    if (res.success) {
      message.success(t('common.updateSuccess') || '修改成功');
    } else {
      throw new Error('Update failed');
    }
  };

  useEffect(() => {
    const fetchFile = async () => {
      if (!resource?.refId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await getFileMeta(resource.refId);
        if (data?.file) {
          setFileMeta(data.file);
        }
      } catch (err) {
        console.error('Failed to fetch file meta:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFile();
  }, [resource?.refId]);

  const handleDownload = useCallback(async () => {
    if (!resource?.refId) return;
    try {
      await downloadAndSave(downloadFile, resource.refId, fileMeta?.name || resource.title || 'file');
    } catch (err) {
      message.error(t('common.downloadFailed') || '下载失败');
    }
  }, [resource?.refId, fileMeta?.name, resource.title, t]);

  const handleDelete = useCallback(async () => {
    if (!resource) return;
    Modal.confirm({
      title: t('documentResourcePanel.deleteTitle') || '删除资源',
      icon: <ExclamationCircleOutlined />,
      content: t('documentResourcePanel.deleteContent') || '确定要删除这个资源吗？此操作无法撤销。',
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

  const extraActions = useMemo(
    () => (
      <Space>
        <Button icon={<DownloadOutlined />} onClick={handleDownload} size="small">
          {t('common.download') || '下载'}
        </Button>
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
      </Space>
    ),
    [handleDownload, handleDelete, t]
  );

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin tip="加载中..." />
      </div>
    );
  }

  const displayName = fileMeta?.name || resource.title || 'Unknown File';
  const fileSize = fileMeta?.size ? (fileMeta.size / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <ResourcePanelHeader
        breadcrumbItems={breadcrumbItems}
        siderCollapsed={isSidebarCollapsed}
        setSiderCollapsed={setSidebarCollapsed}
        extraActions={extraActions}
      />

      <div style={{ flex: 1, padding: '32px 40px', overflow: 'auto' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ 
              width: 80, 
              height: 80, 
              background: '#f7f7f5', 
              borderRadius: 20, 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: 16
            }}>
              {getResourceIcon(resource.type, { large: true })}
            </div>
            
            <div style={{ marginBottom: 8 }}>
              <EditableTitle 
                value={resource.title || displayName}
                onSave={handleUpdateName}
                level={3}
                style={{ justifyContent: 'center' }}
              />
            </div>

            <Space>
              <Tag color="blue" style={{ borderRadius: 4 }}>{resource.type?.toUpperCase()}</Tag>
              <Text type="secondary" style={{ fontSize: 13 }}>{fileSize}</Text>
            </Space>
          </div>

          <Descriptions 
            bordered 
            column={1} 
            size="small"
            style={{ 
              background: '#fff', 
              borderRadius: 8, 
              overflow: 'hidden',
              border: '1px solid #edece9' 
            }}
          >
            <Descriptions.Item label="资源名称">{resource.title}</Descriptions.Item>
            <Descriptions.Item label="资源类型">{resource.type}</Descriptions.Item>
            <Descriptions.Item label="文件 ID">{resource.refId || 'N/A'}</Descriptions.Item>
            {fileMeta?.contentType && (
              <Descriptions.Item label="MIME 类型">{fileMeta.contentType}</Descriptions.Item>
            )}
            {fileMeta?.updatedAt && (
              <Descriptions.Item label="更新时间">
                {new Date(fileMeta.updatedAt).toLocaleString()}
              </Descriptions.Item>
            )}
          </Descriptions>

          <div style={{ marginTop: 40, textAlign: 'center' }}>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />} 
              size="large" 
              onClick={handleDownload}
              style={{ borderRadius: 8, padding: '0 48px', height: 44, fontWeight: 500 }}
            >
              立即下载
            </Button>
          </div>
          
          <div style={{ 
            marginTop: 40, 
            display: 'flex', 
            alignItems: 'flex-start', 
            gap: 12, 
            padding: '16px 20px', 
            background: '#fcfaf3', 
            borderRadius: 8,
            border: '1px solid #f9f1c0'
          }}>
            <InfoCircleOutlined style={{ color: '#faad14', marginTop: 3, fontSize: 16 }} />
            <Text type="secondary" style={{ fontSize: 13, color: '#444' }}>
              该文件类型暂时无法直接在线预览。你可以点击上方按钮下载到本地，使用相应的专业软件查看。
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DefaultResourcePanel;
