import React, { useState, useEffect } from 'react';
import { Descriptions, Card, Tag, Timeline, Spin, message, Collapse, theme } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getExecutionById, getWorkflowById } from '../../api/workflow';
import PageHeader from '../../components/PageHeader';
import dayjs from 'dayjs';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import XMarkdownDisplay from '../../components/common/XMarkdownDisplay';

const WorkflowExecutionDetailPage = () => {
  const { t } = useTranslation();
  const { appId, workflowId, executionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [execution, setExecution] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const { token } = theme.useToken();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [executionData, workflowData] = await Promise.all([
          getExecutionById(workflowId, executionId),
          getWorkflowById(workflowId),
        ]);
        setExecution(executionData);
        setWorkflow(workflowData);
      } catch (err) {
        message.error(t('common.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [workflowId, executionId]);

  if (loading || !execution) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        <Spin size="large" />
      </div>
    );
  }

  const getStatusColor = (status) => {
    if (status === 'SUCCESS' || status === 'COMPLETED') return 'success';
    if (status === 'FAILED') return 'error';
    return 'processing';
  };

  const getStatusIcon = (status) => {
    if (status === 'SUCCESS' || status === 'COMPLETED') return <CheckCircleOutlined />;
    if (status === 'FAILED') return <CloseCircleOutlined />;
    return <LoadingOutlined />;
  };

  // Convert nodeResults Map to array for display
  const nodeResultsArray = execution.nodeResults
    ? Object.entries(execution.nodeResults).map(([nodeId, result]) => ({
        nodeId,
        result,
      }))
    : [];

  // Try to find readable node names from workflow definition if available
  const getNodeName = (nodeId) => {
    if (!workflow || !workflow.nodes) return nodeId;
    const node = workflow.nodes.find((n) => n.id === nodeId);
    return node ? node.data?.label || node.type : nodeId;
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        onBack={() => navigate(`/apps/${appId}/workflows/${workflowId}/history`)}
        title={`${t('workflow.history.executionId')}: ${execution._id.slice(-6)}`}
        tags={
          <Tag color={getStatusColor(execution.status)}>
            {t(
              `workflow.history.status${execution.status === 'COMPLETED' ? 'Success' : execution.status.charAt(0) + execution.status.slice(1).toLowerCase()}`,
              execution.status,
            )}
          </Tag>
        }
        showUser={true}
      />

      <div style={{ padding: 24, flexGrow: 1, height: 0, overflow: 'auto' }}>
        <Card title={t('workflow.history.title')} bordered={false} style={{ marginBottom: 24 }}>
          <Descriptions column={2}>
            <Descriptions.Item label={t('workflow.history.triggerTime')}>
              {dayjs(execution.triggerData?.triggeredAt || execution.createdAt).format(
                'YYYY-MM-DD HH:mm:ss',
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('workflow.history.triggerType')}>
              {t(
                `workflow.history.types.${execution.triggerData?.triggerType}`,
                execution.triggerData?.triggerType,
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('workflow.history.executionId')} span={2}>
              {execution._id}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title={t('workflow.history.logs')} bordered={false}>
          {/* Simple visualization of node results */}
          <Timeline mode="left">
            {/* Trigger Info */}
            <Timeline.Item color="green" dot={<ClockCircleOutlined />}>
              <p style={{ fontWeight: 600 }}>Create/Trigger</p>
              <Collapse ghost size="small">
                <Collapse.Panel header="Trigger Data" key="trigger">
                  <XMarkdownDisplay>
                    {`\`\`\`json
${JSON.stringify(execution.triggerData || {}, null, 2)}
\`\`\``}
                  </XMarkdownDisplay>
                </Collapse.Panel>
              </Collapse>
            </Timeline.Item>

            {/* Node Executions */}
            {nodeResultsArray.map(({ nodeId, result }) => (
              <Timeline.Item
                key={nodeId}
                color={result.status === 'ERROR' ? 'red' : 'green'}
                dot={result.status === 'ERROR' ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
              >
                <p style={{ fontWeight: 600 }}>
                  {getNodeName(nodeId)}{' '}
                  <span style={{ fontSize: 12, color: '#999', fontWeight: 400 }}>({nodeId})</span>
                </p>
                <Collapse ghost size="small">
                  <Collapse.Panel header="Output Data" key="output">
                    <XMarkdownDisplay>
                      {`\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\``}
                    </XMarkdownDisplay>
                  </Collapse.Panel>
                </Collapse>
              </Timeline.Item>
            ))}

            {/* End Status */}
            <Timeline.Item
              color={getStatusColor(execution.status)}
              dot={getStatusIcon(execution.status)}
            >
              <p style={{ fontWeight: 600 }}>
                {t(
                  `workflow.history.status${execution.status.charAt(0) + execution.status.slice(1).toLowerCase()}`,
                  execution.status,
                )}
              </p>
              {execution.error && (
                <div style={{ color: 'red', marginTop: 8 }}>
                  <p>Error: {execution.error.message}</p>
                </div>
              )}
            </Timeline.Item>
          </Timeline>
        </Card>
      </div>
    </div>
  );
};

export default WorkflowExecutionDetailPage;
