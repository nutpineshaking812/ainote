import React, { useEffect, useState } from 'react';
import { Card, Button, Typography, Descriptions, Space, Tag, message, Spin, Avatar } from 'antd';
import * as AntdIcons from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { getApp } from '../../api/apps';
import EditAppModal from '../../features/dashboard/EditAppModal';

const { Title, Text } = Typography;

const AppInfoPage = () => {
  const { t } = useTranslation();
  const { appId } = useParams();
  const [loading, setLoading] = useState(false);
  const [appData, setAppData] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // 加载数据
  const loadAppData = async () => {
    setLoading(true);
    try {
      const data = await getApp(appId);
      setAppData(data);
    } catch (error) {
      message.error(error.message || t('common.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (appId) {
      loadAppData();
    }
  }, [appId, t]);

  // 处理编辑完成
  const handleAppUpdated = (updatedApp) => {
    setAppData(updatedApp);
  };

  // 图标组件
  const AppIcon = ({ icon, color }) => {
    const IconComponent = AntdIcons[icon];
    return (
      <Avatar
        shape="square"
        size={48}
        style={{
          backgroundColor: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        icon={IconComponent ? <IconComponent /> : <AntdIcons.AppstoreOutlined />}
      />
    );
  };

  if (loading && !appData) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  if (!appData) return null;

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={t('appSettings.appInfo')}
        extra={
          <Button type="primary" ghost onClick={() => setEditModalVisible(true)}>
            {t('common.edit')}
          </Button>
        }
        bordered={true}
      >
        <Descriptions
          column={1}
          labelStyle={{ width: '120px', color: '#8c8c8c' }}
          contentStyle={{ color: '#262626', fontWeight: 500 }}
        >
          <Descriptions.Item label={t('app.iconLabel')}>
            <AppIcon icon={appData.icon} color={appData.iconColor} />
          </Descriptions.Item>

          <Descriptions.Item label={t('app.nameLabel')}>
            <span style={{ fontSize: '16px' }}>{appData.name}</span>
          </Descriptions.Item>

          <Descriptions.Item label="ID">
            <Space>
              <Text copyable={{ text: appData._id || appData.id }}>
                {appData._id || appData.id}
              </Text>
            </Space>
          </Descriptions.Item>

          <Descriptions.Item label={t('app.descriptionLabel')}>
            <span style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {appData.description || (
                <Text type="secondary">{t('appSettings.noDescription')}</Text>
              )}
            </span>
          </Descriptions.Item>

          <Descriptions.Item label={t('common.createTime')}>
            {appData.createdAt ? new Date(appData.createdAt).toLocaleString() : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 编辑模态框 */}
      <EditAppModal
        open={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        appToEdit={appData}
        onAppUpdated={handleAppUpdated}
      />
    </div>
  );
};

export default AppInfoPage;
