import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Space, Typography, Modal, Badge, message, Popconfirm, Spin } from 'antd';
import {
  RobotOutlined,
  ReloadOutlined,
  EyeOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { getAgentMemoryList, getAgentMemoryContent } from '../../../api/ai';
import PageHeader from '../../../components/PageHeader';
import './MemoryPage.css';

const { Text, Title } = Typography;

const AgentMemoryView = () => {
  const { appId } = useParams();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('');

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await getAgentMemoryList(appId);
      setSessions(res || []);
    } catch {
      message.error('加载 AI 记忆失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (docId, title) => {
    setPreviewLoading(true);
    setPreviewTitle(title);
    setPreviewVisible(true);
    try {
      const res = await getAgentMemoryContent(appId, docId);
      setPreviewContent(res?.content || '# 暂无内容');
    } catch {
      setPreviewContent('# 加载失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [appId]);

  const columns = [
    {
      title: '会话 ID',
      dataIndex: 'sessionId',
      key: 'sessionId',
      width: 280,
      render: (sessionId) => (
        <Text
          copyable
          ellipsis
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        >
          {sessionId || '无会话上下文'}
        </Text>
      ),
    },
    {
      title: '记忆标题',
      dataIndex: 'title',
      key: 'title',
      render: (text) => <Text strong>{text || '智能体长期记忆'}</Text>,
    },
    {
      title: '最后更新',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 200,
      render: (date) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button
          type="primary"
          ghost
          icon={<EyeOutlined />}
          size="small"
          onClick={() => handlePreview(record.docId, record.title)}
        >
          查看
        </Button>
      ),
    },
  ];

  return (
    <div className="app-memory-page">
      <PageHeader
        title="AI 记忆文件"
        desc="Deep Agent 在对话中自动记录的用户偏好和上下文信息"
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchList} loading={loading}>
            刷新
          </Button>
        }
      />
      <div style={{ padding: 24 }}>
        <Table
          dataSource={sessions}
          columns={columns}
          rowKey="docId"
          loading={loading}
          pagination={{ pageSize: 12, hideOnSinglePage: true }}
          locale={{ emptyText: '暂无 AI 记忆数据。在对话中与 Deep Agent 交互后，AI 会自动记录偏好和上下文信息。' }}
        />

        <Modal
          title={
            <Space>
              <RobotOutlined />
              <span>{previewTitle || 'AI 记忆'}</span>
            </Space>
          }
          open={previewVisible}
          onCancel={() => setPreviewVisible(false)}
          footer={null}
          width={720}
        >
          {previewLoading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spin />
            </div>
          ) : (
            <div
              style={{
                maxHeight: '60vh',
                overflow: 'auto',
                padding: 16,
                background: '#fafafa',
                borderRadius: 8,
                fontFamily: 'monospace',
                fontSize: 13,
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}
            >
              {previewContent}
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default AgentMemoryView;
