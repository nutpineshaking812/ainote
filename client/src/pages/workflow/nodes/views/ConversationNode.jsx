import React from 'react';
import { Typography } from 'antd';
import {
  MessageOutlined,
  SettingOutlined,
  HistoryOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNodeLayout from './BaseNodeLayout';

const { Text } = Typography;

const NODE_CONFIG = {
  addMessage: {
    icon: <MessageOutlined />,
    color: '#52c41a',
    titleKey: 'workflow.nodes.addMessage.title',
    defaultTitle: 'Add Message',
  },
  openChatBubble: {
    icon: <PlayCircleOutlined />,
    color: '#faad14',
    titleKey: 'workflow.nodes.openChatBubble.title',
    defaultTitle: 'Open Chat Bubble',
  },
  fetchMemory: {
    icon: <HistoryOutlined />,
    color: '#722ed1',
    titleKey: 'workflow.nodes.fetchMemory.title',
    defaultTitle: 'Fetch Memory',
  },
  loadMemory: {
    icon: <HistoryOutlined />,
    color: '#722ed1',
    titleKey: 'workflow.nodes.loadMemory.title',
    defaultTitle: 'Fetch History Messages',
  },
  persistMsg: {
    icon: <SaveOutlined />,
    color: '#595959',
    titleKey: 'workflow.nodes.persistMsg.title',
    defaultTitle: 'Persist Message',
  },
  sendSseEvent: {
    icon: <ThunderboltOutlined />,
    color: '#eb2f96',
    titleKey: 'workflow.nodes.sendSseEvent.title',
    defaultTitle: 'Send SSE Event',
  },
  buildAnalysisQuery: {
    icon: <SettingOutlined />,
    color: '#fa8c16',
    titleKey: 'workflow.nodes.buildAnalysisQuery.title',
    defaultTitle: 'Build Query',
  },
  mongoAggregate: {
    icon: <PlayCircleOutlined />,
    color: '#52c41a',
    titleKey: 'workflow.nodes.mongoAggregate.title',
    defaultTitle: 'Execute Query',
  },
};

const ConversationNode = (props) => {
  const { data, type } = props;
  const { t } = useTranslation();
  
  const activeType = type || props.node?.type;
  const config = NODE_CONFIG[activeType] || NODE_CONFIG.addMessage;

  return (
    <BaseNodeLayout
      {...props}
      icon={config.icon}
      color={config.color}
      title={t(config.titleKey, config.defaultTitle)}
      subtitle={data.label || t('workflow.nodes.common.noLabel', 'Atomic AI Task')}
    >
      <div style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: '10px', fontStyle: 'italic' }}>
          {type}
        </Text>
      </div>
    </BaseNodeLayout>
  );
};

export default ConversationNode;
