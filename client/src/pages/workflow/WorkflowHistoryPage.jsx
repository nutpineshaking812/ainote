import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, message, Space } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getWorkflowExecutions, getWorkflowById } from '../../api/workflow';
import PageHeader from '../../components/PageHeader';
import { ClockCircleOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const WorkflowHistoryPage = () => {
  const { t } = useTranslation();
  const { appId, workflowId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [executions, setExecutions] = useState([]);
  const [total, setTotal] = useState(0);
  const [workflow, setWorkflow] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  const fetchWorkflow = async () => {
    try {
      const data = await getWorkflowById(workflowId);
      setWorkflow(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async (page = 1, limit = 20) => {
    setLoading(true);
    try {
      const { executions, total } = await getWorkflowExecutions(workflowId, { page, limit });
      setExecutions(executions);
      setTotal(total);
      setPagination({ ...pagination, current: page, pageSize: limit });
    } catch (err) {
      message.error(t('common.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflow();
    fetchHistory();
  }, [workflowId]);

  const columns = [
    {
      title: t('workflow.history.triggerTime', 'Trigger Time'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => (
        <Space>
          <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
          {dayjs(date).format('YYYY-MM-DD HH:mm:ss')}
        </Space>
      ),
    },
    {
      title: t('workflow.history.executionId', 'Execution ID'),
      dataIndex: '_id',
      key: '_id',
      render: (id) => <Tag style={{ fontFamily: 'monospace' }}>{id.slice(-6)}</Tag>,
    },
    {
      title: t('workflow.history.triggerType', 'Trigger Type'),
      dataIndex: ['triggerData', 'triggerType'],
      key: 'triggerType',
      render: (type) => {
        const colorMap = {
          SCHEDULE: 'green',
          MANUAL: 'blue',
          WEBHOOK: 'orange',
          EVENT: 'purple',
          MANUAL_STREAM: 'cyan',
          DATACHANGE: 'gold',
        };
        return (
          <Tag color={colorMap[type] || 'default'}>{t(`workflow.history.types.${type}`, type)}</Tag>
        );
      },
    },
    {
      title: t('workflow.history.triggeredBy', 'Triggered By'),
      dataIndex: 'triggeredBy',
      key: 'triggeredBy',
      render: (user) => (user ? user.username || user.email : t('common.system', 'System')),
    },
    {
      title: t('workflow.history.status', 'Status'),
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        let color = 'default';
        let text = status;

        if (status === 'SUCCESS' || status === 'COMPLETED') {
          // COMPLETED is legacy/frontend override
          color = 'success';
          text = t('workflow.history.statusSuccess', 'Success');
        } else if (status === 'FAILED') {
          color = 'error';
          text = t('workflow.history.statusFailed', 'Failed');
        } else if (status === 'RUNNING') {
          color = 'processing';
          text = t('workflow.history.statusRunning', 'Running');
        } else {
          // Fallback for empty or unknown status to Completed/Success as per current behavior
          color = 'success';
          text = t('workflow.history.statusSuccess', 'Success');
        }
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => {
            navigate(`/apps/${appId}/workflows/${workflowId}/history/${record._id}`);
          }}
        >
          {t('workflow.history.viewDetail')}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        showUser={true}
        onBack={() => navigate(`/apps/${appId}/workflows`)}
        title={
          workflow
            ? `${workflow.name} - ${t('workflow.history.title', 'Execution History')}`
            : t('workflow.history.title', 'Execution History')
        }
      />

      <div style={{ padding: 24, flex: 1 }}>
        <Table
          columns={columns}
          dataSource={executions}
          rowKey="_id"
          loading={loading}
          pagination={{
            ...pagination,
            total,
            onChange: (page, pageSize) => fetchHistory(page, pageSize),
          }}
        />
      </div>
    </div>
  );
};

export default WorkflowHistoryPage;
