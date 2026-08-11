import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, message, Tag, Popconfirm } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  ArrowLeftOutlined,
  ClockCircleOutlined,
  PauseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  executeWorkflow,
} from '../../api/workflow';
import PageHeader from '../../components/PageHeader';
import dayjs from 'dayjs';

const { Option } = Select;

const WorkflowListPage = () => {
  const { t } = useTranslation();
  const { appId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const data = await getWorkflows({ appId });
      setWorkflows(data || []);
    } catch (err) {
      message.error(t('common.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, [appId]);

  const handleCreate = () => {
    navigate(`/apps/${appId}/workflows/new`);
  };

  const handleToggleStatus = async (record) => {
    try {
      const newStatus = record.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await updateWorkflow(record._id, { status: newStatus });
      message.success(t('common.updateSuccess'));
      fetchWorkflows();
    } catch (err) {
      message.error(t('common.operationFailed'));
    }
  };

  const [runningWorkflows, setRunningWorkflows] = useState({}); // { [id]: boolean }

  const handleRun = async (record) => {
    // Set running state
    setRunningWorkflows((prev) => ({ ...prev, [record._id]: true }));
    const hideMsg = message.loading(t('workflow.list.running', 'Running...'), 0);

    try {
      const { streamWorkflowExecute } = await import('../../api/workflow');
      const { fetchEventSource } = await import('../../utils/sse');

      // Use similar logic to Designer but silent or minimal UI
      const abortController = fetchEventSource(
        streamWorkflowExecute(record._id),
        { method: 'POST' },
        {
          onmessage: (msg) => {
            const { event, data } = msg;
            if (event === 'workflow:success') {
              message.success(t('workflow.list.runSuccess'));
              hideMsg();
              setRunningWorkflows((prev) => ({ ...prev, [record._id]: false }));
              fetchWorkflows();
              abortController.abort();
            } else if (event === 'workflow:error') {
              message.error(t('workflow.list.runFailed'));
              hideMsg();
              setRunningWorkflows((prev) => ({ ...prev, [record._id]: false }));
              abortController.abort();
            }
          },
          onerror: (err) => {
            console.error('SSE Error', err);
            hideMsg();
            setRunningWorkflows((prev) => ({ ...prev, [record._id]: false }));
            // message.error(t('common.operationFailed')); // Optional, avoid spam
          },
        },
      );
    } catch (err) {
      console.error(err);
      hideMsg();
      setRunningWorkflows((prev) => ({ ...prev, [record._id]: false }));
      message.error(t('common.operationFailed'));
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteWorkflow(id);
      message.success(t('common.deleteSuccess'));
      fetchWorkflows();
    } catch (err) {
      message.error(t('common.deleteFailed'));
    }
  };

  const columns = [
    {
      title: t('workflow.list.name'),
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
    },
    {
      title: t('workflow.list.org', 'Organization'),
      dataIndex: ['organizationId', 'name'],
      key: 'org',
    },
    {
      title: t('workflow.list.creator', 'Creator'),
      dataIndex: 'createdBy',
      key: 'creator',
      render: (user) => (user ? user.username || user.email : '-'),
    },
    {
      title: t('workflow.list.triggerType'),
      dataIndex: 'triggerType',
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
          <Tag color={colorMap[type] || 'default'}>
            {t(`workflow.list.${type.toLowerCase()}`, type)}
          </Tag>
        );
      },
    },
    {
      title: t('workflow.list.createdAt', 'Created At'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: t('workflow.list.updatedAt', 'Last Edited'),
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: t('workflow.list.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'ACTIVE' ? 'success' : 'default'}>
          {status === 'ACTIVE' ? t('workflow.list.active') : t('workflow.list.inactive')}
        </Tag>
      ),
    },
    {
      title: t('workflow.list.lastRun'),
      dataIndex: 'lastRunAt',
      key: 'lastRunAt',
      render: (date, record) =>
        date ? (
          <a onClick={() => navigate(`/apps/${appId}/workflows/${record._id}/history`)}>
            {dayjs(date).format('YYYY-MM-DD HH:mm:ss')}
          </a>
        ) : (
          '-'
        ),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() =>
              navigate(`/apps/${appId}/workflows/${record._id}`, {
                state: { backPath: location.pathname + location.search },
              })
            }
          >
            {t('workflow.list.design')}
          </Button>

          {/* Activate/Pause for Schedule/Webhook */}
          {['SCHEDULE', 'WEBHOOK'].includes(record.triggerType) ? (
            <Button
              type="link"
              size="small"
              icon={record.status === 'ACTIVE' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={() => handleToggleStatus(record)}
            >
              {record.status === 'ACTIVE' ? t('workflow.list.inactive') : t('workflow.list.active')}
            </Button>
          ) : (
            <Popconfirm
              title={t('workflow.list.confirmRun', 'Run this workflow?')}
              onConfirm={() => handleRun(record)}
              okText={t('common.yes')}
              cancelText={t('common.no')}
            >
              <Button
                type="link"
                size="small"
                icon={runningWorkflows[record._id] ? <LoadingOutlined /> : <PlayCircleOutlined />}
                disabled={runningWorkflows[record._id]}
              >
                {runningWorkflows[record._id]
                  ? t('workflow.list.runningStatus', 'Running')
                  : t('common.run')}
              </Button>
            </Popconfirm>
          )}

          <Button
            type="link"
            size="small"
            icon={<ClockCircleOutlined />}
            onClick={() => navigate(`/apps/${appId}/workflows/${record._id}/history`)}
          >
            {t('workflow.list.history', 'History')}
          </Button>

          <Popconfirm
            title={t('common.confirmDelete')}
            onConfirm={() => handleDelete(record._id)}
            okText={t('common.yes')}
            cancelText={t('common.no')}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        onBack={() => navigate(`/apps/${appId}`)}
        title={t('workflow.list.title')}
        showUser={true}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {t('workflow.list.create')}
          </Button>
        }
      />

      <div style={{ padding: 24, flex: 1 }}>
        <Table
          columns={columns}
          dataSource={workflows}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </div>
    </div>
  );
};

export default WorkflowListPage;
