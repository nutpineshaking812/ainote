import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Space, Typography, message, Tooltip, Alert, Badge } from 'antd';
import {
  ThunderboltOutlined,
  EditOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { getWorkflows } from '../../api/workflow';
import PageHeader from '../../components/PageHeader';
import { hide } from '@floating-ui/react';

const { Title, Text } = Typography;

const AppAiLogicPage = () => {
  const { t } = useTranslation();
  const { appId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState([]);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      // Pass includeSystem to trigger the registry merging logic
      const data = await getWorkflows({ appId, includeSystem: true });
      // Filter only system workflows for this page
      const systemFlows = data.filter((w) => w.isSystem || w.workflowKey);
      setWorkflows(systemFlows);
    } catch (error) {
      console.error('Error fetching AI workflows:', error);
      message.error(t('common.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, [appId]);

  const handleEdit = (record) => {
    // Navigate to workflow designer
    navigate(`/apps/${appId}/workflows/${record._id}`, {
      state: { backPath: location.pathname + location.search },
    });
  };

  const columns = [
    {
      title: t('workflow.nodes.common.name') || '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => {
        const nameKey = `workflow.builtin.${record.workflowKey}`;
        const descKey = `${nameKey}.desc`;
        const translatedName = record.workflowKey ? t(nameKey) : text;
        const translatedDesc = record.workflowKey ? t(descKey) : record.description;

        const displayName = translatedName !== nameKey ? translatedName : text || record.name;
        const displayDesc = translatedDesc !== descKey ? translatedDesc : record.description;

        return (
          <Space direction="vertical" size={0}>
            <Text strong>{displayName}</Text>
            {displayDesc && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {displayDesc}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category) => {
        if (category === 'AI_MEMORY_DISTILL') return <Tag color="blue">提炼策略 (Distill)</Tag>;
        if (category === 'AI_MEMORY_RECALL') return <Tag color="orange">召回策略 (Recall)</Tag>;
        if (category === 'GET_RESOURCE_SUMMARY') return <Tag color="purple">资源总结</Tag>;
        return <Tag>通用</Tag>;
      },
    },
    {
      title: t('workflow.nodes.common.status') || '状态',
      key: 'status',
      width: 200,
      render: (_, record) => (
        <Space>
          {record.isCustomized ? (
            <Tag color="orange" icon={<EditOutlined />}>
              {t('appSettings.aiCustomized') || '已定制'}
            </Tag>
          ) : (
            <Tag color="blue" icon={<CheckCircleOutlined />}>
              {t('appSettings.aiBuiltIn') || '系统内置'}
            </Tag>
          )}
          {record.status === 'ACTIVE' ? (
            <Badge status="processing" text={t('common.active') || '启用中'} />
          ) : (
            <Badge status="default" text={t('common.inactive') || '未启用'} />
          )}
        </Space>
      ),
    },
    {
      title: t('workflow.list.updatedAt') || '最后更新',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 150,
      render: (date) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: t('common.action') || '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title={t('common.edit')}>
            <Button
              type="primary"
              ghost
              icon={<SettingOutlined />}
              onClick={() => handleEdit(record)}
            >
              配置逻辑
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div
      style={{ width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      size={0}
    >
      <PageHeader
        title={t('appSettings.aiLogic') || '核心流程'}
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchWorkflows} loading={loading}>
            {t('common.refresh')}
          </Button>
        }
        style={{ borderBottom: '1px solid #f0f0f0' }}
      />

      <div style={{ padding: 24, overflow: 'auto' }}>
        {/* <Card bordered={false} bodyStyle={{ padding: 0 }}> */}
        <Table
          dataSource={workflows}
          columns={columns}
          rowKey={(record) => record._id || record.workflowKey}
          loading={loading}
          pagination={false}
        />
        {/* </Card> */}

        {!loading && workflows.length === 0 && (
          <div style={{ marginTop: 16 }}>
            <Alert
              message="未检测到可用的系统 AI 流程"
              description="请检查后端 workflow-registry 是否配置正确。"
              type="warning"
              showIcon
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AppAiLogicPage;
