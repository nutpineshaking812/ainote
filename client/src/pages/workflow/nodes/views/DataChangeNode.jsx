import React from 'react';
import { Typography, Tag } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNodeLayout from './BaseNodeLayout';

const { Text } = Typography;

const DataChangeNode = (props) => {
  const { data, id } = props;
  const { t } = useTranslation();

  return (
    <BaseNodeLayout
      {...props}
      id={id}
      icon={<DatabaseOutlined />}
      color="#fa8c16"
      title={t('workflow.nodes.dataChange.title')}
      subtitle={t('workflow.nodes.dataChange.desc')}
      hideLeftHandle={true}
    >
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
        <Tag
          color="orange"
          style={{ fontSize: '10px', borderRadius: '4px', margin: 0 }}
        >
          {data.event || 'update'}
        </Tag>
      </div>
    </BaseNodeLayout>
  );
};

export default DataChangeNode;
