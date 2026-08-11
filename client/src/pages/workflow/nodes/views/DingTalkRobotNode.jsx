import React from 'react';
import { Typography } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNodeLayout from './BaseNodeLayout';

const { Text } = Typography;

const DingTalkRobotNode = (props) => {
  const { data, id } = props;
  const { t } = useTranslation();

  return (
    <BaseNodeLayout
      {...props}
      id={id}
      icon={<SendOutlined />}
      color="#007fff"
      title={t('workflow.nodes.dingTalkRobot.title')}
      subtitle={data.title || (data.content ? (data.content.length > 20 ? data.content.substring(0, 20) + '...' : data.content) : '-')}
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
        {data.webhook ? (data.webhook.substring(0, 40) + '...') : 'No Webhook'}
      </div>
    </BaseNodeLayout>
  );
};

export default DingTalkRobotNode;
