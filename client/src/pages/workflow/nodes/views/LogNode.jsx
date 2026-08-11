import React from 'react';
import { Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNodeLayout from './BaseNodeLayout';

const { Text } = Typography;

const LogNode = (props) => {
  const { data, id } = props;
  const { t } = useTranslation();

  return (
    <BaseNodeLayout
      {...props}
      id={id}
      icon={<FileTextOutlined />}
      color="#595959"
      title={t('workflow.nodes.log.title')}
      subtitle={data.message || 'Debug Output'}
    >
      <div
        style={{
          background: '#f5f5f5',
          padding: '4px 8px',
          borderRadius: '4px',
          marginTop: 8,
          fontSize: '10px',
          fontFamily: 'monospace',
          textAlign: 'left',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {data.message || '...'}
      </div>
    </BaseNodeLayout>
  );
};

export default LogNode;
