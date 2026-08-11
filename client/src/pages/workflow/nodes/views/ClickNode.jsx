import React from 'react';
import { Typography } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNodeLayout from './BaseNodeLayout';

const { Text } = Typography;

const ClickNode = (props) => {
  const { data = {}, id } = props;
  const { t } = useTranslation();

  return (
    <BaseNodeLayout
      {...props}
      id={id}
      icon={<ThunderboltOutlined />}
      color="#faad14"
      title={t('workflow.nodes.click.title')}
      subtitle={t('workflow.nodes.click.desc')}
      hideLeftHandle={true}
    >
      <div style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: '11px', fontStyle: 'italic' }}>
          {t('workflow.nodes.click.manualTrigger', 'Manual or API Trigger')}
        </Text>
      </div>
    </BaseNodeLayout>
  );
};

export default ClickNode;
