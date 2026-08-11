import React from 'react';
import {
  Form,
  Input,
  Checkbox,
  InputNumber,
  Typography,
  Alert,
  Button,
  message,
  Space,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import NodePropertyCollapse from './NodePropertyCollapse';
import SchemaConfigList from './SchemaConfigList';

const { Text, Paragraph } = Typography;

const WebhookProperties = ({ node, setNodes }) => {
  const { t } = useTranslation();
  const { workflowId } = useParams();

  // Fix: Use Vite env var and ensure full URL
  const rawApiUrl = import.meta.env.VITE_API_URL || '/api/v1';
  // Ensure we have a full URL for the copy button
  const baseUrl = rawApiUrl.startsWith('http')
    ? rawApiUrl
    : `${window.location.origin}${rawApiUrl}`;

  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  // Note: API_URL usually includes /api/v1, checking mount path
  const webhookUrl = `${cleanBaseUrl}/workflows/webhook/${workflowId || ':workflowId'}`;

  const secret = Form.useWatch('secret') || node.data?.secret;
  const methods = Form.useWatch('methods') || node.data?.methods || ['POST'];

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    message.success(t('workflow.designer.copySuccess'));
  };

  const handleRegenerateSecret = () => {
    const newSecret =
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setNodes((nds) =>
      nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, secret: newSecret } } : n)),
    );
  };

  // Ensure secret exists on load, and sync useRateLimit
  React.useEffect(() => {
    const updates = {};
    if (!node.data?.secret) {
      updates.secret =
        Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    if (node.data?.rateLimit && node.data.useRateLimit === undefined) {
      updates.useRateLimit = true;
    }

    if (Object.keys(updates).length > 0) {
      setNodes((nds) =>
        nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, ...updates } } : n)),
      );
    }
  }, [node.data?.secret, node.data?.rateLimit, node.data?.useRateLimit, node.id, setNodes]);

  const handleValuesChange = (allValues, next) => {
    // Detect toggles by comparing new Form values with current Node data
    const rateLimitToggledOn = allValues.useRateLimit === true && node.data?.useRateLimit !== true;

    // Rate Limit logic
    if (rateLimitToggledOn) {
      allValues.rateLimit = null; // Start empty explicitly on toggle
    } else if (!allValues.useRateLimit) {
      allValues.rateLimit = null; // Ensure clearing
    }

    next(allValues);
  };

  const curlExample = `curl -X ${methods.includes('POST') ? 'POST' : 'GET'} '${webhookUrl}?delay=5' \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-secret: ${secret || '<SECRET>'}" \\
  ${methods.includes('POST') ? "-d '{\"key\": \"value\"}'" : ''}`;

  const getUrlExample = `${webhookUrl}?secret=${secret || '<SECRET>'}`;
  const curlGetExample = `curl -X GET '${webhookUrl}?secret=${secret || '<SECRET>'}'`;

  const cancelUrl = `${cleanBaseUrl}/workflows/webhook/${workflowId || ':workflowId'}/executions/{executionId}/cancel`;
  const curlCancelExample = `curl -X POST '${cancelUrl}' \\
  -H "x-webhook-secret: ${secret || '<SECRET>'}"`;

  return (
    <NodePropertyCollapse node={node} setNodes={setNodes} onValuesChange={handleValuesChange}>
      <Form.Item label={t('workflow.designer.webhookUrl')} style={{ marginBottom: 8 }}>
        <Input.Group compact>
          <Input style={{ width: 'calc(100% - 32px)' }} value={webhookUrl} readOnly />
          <Button icon={<CopyOutlined />} onClick={handleCopy} />
        </Input.Group>
      </Form.Item>

      <div style={{ marginBottom: 16 }}>
        <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 4 }}>
          {t('workflow.designer.webhookExecutionIdTip')}
        </Paragraph>
        <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
          {t('workflow.designer.webhookDelayTip')}
        </Paragraph>
      </div>

      <Form.Item label={t('workflow.designer.methods')} name="methods" initialValue={['POST']}>
        <Checkbox.Group
          options={[
            { label: 'GET', value: 'GET' },
            { label: 'POST', value: 'POST' },
          ]}
        />
      </Form.Item>

      <Form.Item label={t('workflow.designer.secret')} required>
        <Input.Group compact>
          <Form.Item name="secret" noStyle>
            <Input style={{ width: 'calc(100% - 32px)' }} placeholder="Secret key" />
          </Form.Item>
          <Button icon={<ReloadOutlined />} onClick={handleRegenerateSecret} />
        </Input.Group>
      </Form.Item>

      <Form.Item name="useRateLimit" valuePropName="checked">
        <Checkbox>{t('workflow.designer.useRateLimit')}</Checkbox>
      </Form.Item>

      <Form.Item noStyle dependencies={['useRateLimit']}>
        {({ getFieldValue }) =>
          getFieldValue('useRateLimit') && (
            <Form.Item label={t('workflow.designer.rateLimit')} name="rateLimit">
              <InputNumber style={{ width: '100%' }} min={1} placeholder="60" />
            </Form.Item>
          )
        }
      </Form.Item>

      <div style={{ marginTop: 16 }}>
        <Text strong>{t('workflow.designer.curlExample')}</Text>
        <Alert
          message={
            <Paragraph
              copyable
              style={{
                marginBottom: 0,
                fontFamily: 'monospace',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
              }}
            >
              {curlExample}
            </Paragraph>
          }
          type="info"
          style={{ marginTop: 8 }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <Text strong>GET 触发链接 (无需 Header / 支持浏览器直接访问)</Text>
        <Alert
          message={
            <Paragraph
              copyable
              style={{
                marginBottom: 0,
                fontFamily: 'monospace',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
              }}
            >
              {getUrlExample}
            </Paragraph>
          }
          type="success"
          style={{ marginTop: 8 }}
        />
      </div>
      <div style={{ marginTop: 24 }}>
        <Text strong>{t('workflow.designer.curlCancelExample')}</Text>
        <Alert
          message={
            <Paragraph
              copyable
              style={{
                marginBottom: 0,
                fontFamily: 'monospace',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
              }}
            >
              {curlCancelExample}
            </Paragraph>
          }
          type="warning"
          style={{ marginTop: 8 }}
        />
      </div>

      <SchemaConfigList
        mode="input"
        label="输入定义 (Input Schema)"
        node={node}
        setNodes={setNodes}
      />
    </NodePropertyCollapse>
  );
};

export default WebhookProperties;
