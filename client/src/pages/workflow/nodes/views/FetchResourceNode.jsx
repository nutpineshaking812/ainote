import React from 'react';
import { Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNodeLayout from './BaseNodeLayout';

const { Text } = Typography;

const FetchResourceNode = (props) => {
  const { data, id } = props;
  const { t } = useTranslation();

  return (
    <BaseNodeLayout
      {...props}
      id={id}
      icon={<SearchOutlined />}
      color="#faad14"
      title={t('workflow.nodes.fetchResource.title')}
      subtitle={t('workflow.designer.filterGroup') + ': ' + (data.groups?.length || 0)}
    >
      <div style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: '10px', fontStyle: 'italic' }}>
          {t('workflow.nodes.fetchResource.desc', 'Queries resources based on filters')}
        </Text>
      </div>
    </BaseNodeLayout>
  );
};

export default FetchResourceNode;
