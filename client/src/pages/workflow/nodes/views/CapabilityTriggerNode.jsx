import React from 'react';
import { Space, Typography, Tag } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNodeLayout from './BaseNodeLayout';

const { Text } = Typography;

const CapabilityTriggerNode = (props) => {
  const { data = {}, id } = props;
  const { t } = useTranslation();
  const matchTags = data?.matchTags || [];

  return (
    <BaseNodeLayout
      {...props}
      id={id}
      icon={<ThunderboltOutlined />}
      color="#faad14"
      title={t('workflow.nodes.capability.title')}
      subtitle={t('workflow.nodes.capability.desc')}
      hideLeftHandle={true}
    >
      <div style={{ marginTop: 8 }}>
        <Space wrap size={[0, 4]} justify="center">
          {matchTags.length > 0 ? (
            matchTags.map((tag) => (
              <Tag key={tag} color="orange" style={{ fontSize: '10px', borderRadius: '4px' }}>
                {tag}
              </Tag>
            ))
          ) : (
            <Text type="disabled" style={{ fontSize: '10px', fontStyle: 'italic' }}>
              {t('workflow.nodes.capability.noTags')}
            </Text>
          )}
        </Space>
      </div>
    </BaseNodeLayout>
  );
};

export default CapabilityTriggerNode;
