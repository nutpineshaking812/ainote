import React from 'react';
import { Tag } from 'antd';
import { HourglassOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNodeLayout from './BaseNodeLayout';

const WaitUpdateNode = (props) => {
  const { data, id } = props;
  const { t } = useTranslation();

  return (
    <BaseNodeLayout
      {...props}
      id={id}
      icon={<HourglassOutlined />}
      color="#faad14"
      title={t('workflow.nodes.waitUpdate.title')}
      subtitle={t('workflow.nodes.waitUpdate.desc')}
    >
      <div style={{ marginTop: 8 }}>
        {data.status === 'running' && (
          <Tag color="orange" style={{ fontSize: '10px', borderRadius: '4px' }}>
            Waiting for Signal...
          </Tag>
        )}
      </div>
    </BaseNodeLayout>
  );
};

export default WaitUpdateNode;
