import React from 'react';
import { Tag } from 'antd';
import { ApiOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNodeLayout from './BaseNodeLayout';

const WebhookNode = (props) => {
  const { data, id } = props;
  const { t } = useTranslation();

  return (
    <BaseNodeLayout
      {...props}
      id={id}
      icon={<ApiOutlined />}
      color="#eb2f96"
      title={t('workflow.nodes.webhook.title')}
      subtitle={t('workflow.nodes.webhook.desc')}
      hideLeftHandle={true}
    >
      <div style={{ marginTop: 8 }}>
        <Tag color="magenta" style={{ fontSize: '10px', borderRadius: '4px' }}>
          {data.methods && data.methods.length > 0 ? data.methods.join('/') : 'POST'}
        </Tag>
      </div>
    </BaseNodeLayout>
  );
};

export default WebhookNode;
