import React from 'react';
import {
  DatabaseOutlined,
  SearchOutlined,
  FileTextOutlined,
  EditOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import BaseNodeLayout from './BaseNodeLayout';

const MEMORY_NODE_CONFIGS = {
  vectorIndex: {
    icon: <DatabaseOutlined />,
    color: '#fa8c16',
    title: '向量索引',
    subtitle: '写入知识库',
  },
  vectorSearch: {
    icon: <SearchOutlined />,
    color: '#1677ff',
    title: '向量检索',
    subtitle: '语义搜索知识库',
  },
  fetchMemorySection: {
    icon: <FileTextOutlined />,
    color: '#52c41a',
    title: '读取记忆段落',
    subtitle: '获取记忆项内容',
  },
  upsertMemorySection: {
    icon: <EditOutlined />,
    color: '#722ed1',
    title: '更新记忆段落',
    subtitle: '写入并索引记忆项',
  },
  getExecutionLogs: {
    icon: <HistoryOutlined />,
    color: '#13c2c2',
    title: '获取执行记录',
    subtitle: '提炼历史数据',
  },
  getMemoryHeaders: {
    icon: <DatabaseOutlined />,
    color: '#eb2f96',
    title: '获取知识大纲',
    subtitle: '检索现有标题',
  },
};

const MemoryNode = ({ type, ...props }) => {
  const config = MEMORY_NODE_CONFIGS[type] || MEMORY_NODE_CONFIGS.vectorSearch;
  return (
    <BaseNodeLayout
      {...props}
      icon={config.icon}
      color={config.color}
      title={props.data?.label || config.title}
      subtitle={config.subtitle}
    />
  );
};

export const VectorIndexNode = (props) => <MemoryNode type="vectorIndex" {...props} />;
export const VectorSearchNode = (props) => <MemoryNode type="vectorSearch" {...props} />;
export const FetchMemorySectionNode = (props) => <MemoryNode type="fetchMemorySection" {...props} />;
export const UpsertMemorySectionNode = (props) => <MemoryNode type="upsertMemorySection" {...props} />;
export const GetExecutionLogsNode = (props) => <MemoryNode type="getExecutionLogs" {...props} />;
export const GetMemoryHeadersNode = (props) => <MemoryNode type="getMemoryHeaders" {...props} />;

export default MemoryNode;
