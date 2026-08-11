import React from 'react';
import { Typography } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNodeLayout from './BaseNodeLayout';

const { Text } = Typography;

const NotificationNode = (props) => {
  const { data, id } = props;
  const { t } = useTranslation();

  return (
    <BaseNodeLayout
      {...props}
      id={id}
      icon={<MessageOutlined />}
      color="#1890ff"
      title={t('workflow.nodes.notification.title')}
      subtitle={data.title || t('workflow.nodes.notification.noTitle')}
    >
      <div
        style={{
          marginTop: 8,
          fontSize: '11px',
          color: '#8c8c8c',
          maxHeight: '36px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {data.content || t('workflow.nodes.notification.noContent')}
      </div>
    </BaseNodeLayout>
  );
};

export default NotificationNode;
