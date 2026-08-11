import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Table,
  Tag,
  Typography,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Card,
  Drawer,
  List,
  Divider,
} from 'antd';
import {
  ApiOutlined,
  PlusOutlined,
  DeleteOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloudOutlined,
  DesktopOutlined,
  ToolOutlined,
  BugOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  getMcpServers,
  installMcpServer,
  refreshMcpServer,
  deleteMcpServer,
  updateMcpStatus,
} from '../../../api/mcp';
import { useOrg } from '../../../store/OrgContext';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

const McpManagementPage = forwardRef(({ embedded = false }, ref) => {
  const { t } = useTranslation();
  const { currentOrganization } = useOrg();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    if (!currentOrganization?._id && !currentOrganization?.id) return;
    try {
      setLoading(true);
      const orgId = currentOrganization._id || currentOrganization.id;
      const res = await getMcpServers(orgId);
      setData(res || []);
    } catch (err) {
      message.error(t('mcp.fetchFailed', 'Failed to load MCP list'));
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: fetchData,
  }));

  useEffect(() => {
    fetchData();
  }, [currentOrganization?._id, currentOrganization?.id]);

  // Polling for servers in INSTALLING state
  useEffect(() => {
    const hasInstalling = data.some((s) => s.status === 'INSTALLING');
    if (!hasInstalling) return;

    const timer = setInterval(() => {
      fetchData();
    }, 3000);

    return () => clearInterval(timer);
  }, [data]);

  const handleInstall = async (values) => {
    try {
      setLoading(true);
      let payload = { ...values };

      // Parse JSON configuration if provided in advanced mode
      if (values.configJson) {
        try {
          const config = JSON.parse(values.configJson);
          // Simplified "one-click" install parsing
          if (config.mcpServers) {
            const serverName = Object.keys(config.mcpServers)[0];
            const serverConfig = config.mcpServers[serverName];

            // 启发式判断类型：如果有 command 则是 stdio，如果有 url 则是 http
            const detectedType =
              serverConfig.type ||
              (serverConfig.command ? 'stdio' : serverConfig.url ? 'http' : 'stdio');

            payload = {
              name: serverName,
              label: serverName,
              type: detectedType,
              stdioConfig:
                detectedType === 'stdio'
                  ? {
                      command: serverConfig.command,
                      args: serverConfig.args || [],
                      env: serverConfig.env || {},
                    }
                  : undefined,
              httpConfig:
                detectedType === 'http'
                  ? {
                      url: serverConfig.url,
                      headers: serverConfig.headers || {},
                    }
                  : undefined,
            };
          }
        } catch (e) {
          return message.error(t('mcp.jsonError', 'JSON format error'));
        }
      }

      if (payload.type === 'stdio') {
        if (payload.stdioConfig?.argsJson) {
          try {
            payload.stdioConfig.args = JSON.parse(payload.stdioConfig.argsJson);
            delete payload.stdioConfig.argsJson;
          } catch (e) {
            return message.error(t('mcp.argsJsonError', 'Args JSON format error'));
          }
        }
        if (payload.stdioConfig?.envJson) {
          try {
            payload.stdioConfig.env = JSON.parse(payload.stdioConfig.envJson);
            delete payload.stdioConfig.envJson;
          } catch (e) {
            return message.error(t('mcp.envJsonError', 'Env JSON format error'));
          }
        }
      }

      await installMcpServer(payload);
      message.success(t('mcp.installQueued', 'MCP service successfully queued for installation'));
      setIsModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      message.error(
        err.response?.data?.error?.message || t('mcp.installFailed', 'Installation failed'),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (id) => {
    try {
      setLoading(true);
      await refreshMcpServer(id);
      message.success(t('mcp.discoveryTriggered', 'Discovery refresh triggered'));
      fetchData();
    } catch (err) {
      message.error(t('mcp.refreshFailed', 'Refresh failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteMcpServer(id);
      message.success(t('mcp.uninstallSuccess', 'MCP service uninstalled'));
      fetchData();
    } catch (err) {
      message.error(t('mcp.uninstallFailed', 'Uninstall failed'));
    }
  };

  const columns = [
    {
      title: t('common.name', 'Name'),
      dataIndex: 'label',
      key: 'label',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Space>
            {record.type === 'http' ? <CloudOutlined /> : <DesktopOutlined />}
            <Text strong>{text}</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.name}
          </Text>
        </Space>
      ),
    },
    {
      title: t('common.type', 'Type'),
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag color={type === 'http' ? 'blue' : 'orange'}>{type.toUpperCase()}</Tag>,
    },
    {
      title: t('common.status', 'Status'),
      key: 'status',
      render: (_, record) => {
        const status = record.runtime?.status || record.status;
        let color = 'default';
        let icon = null;

        switch (status) {
          case 'ACTIVE':
          case 'CONNECTED':
            color = 'success';
            icon = <CheckCircleOutlined />;
            break;
          case 'INSTALLING':
            color = 'processing';
            icon = <SyncOutlined spin />;
            break;
          case 'ERROR':
            color = 'error';
            icon = <ExclamationCircleOutlined />;
            break;
          default:
            color = 'default';
        }

        return (
          <Tag color={color} icon={icon}>
            {status}
          </Tag>
        );
      },
    },
    {
      title: t('mcp.discoveredTools', 'Discovered Tools'),
      key: 'toolsCount',
      render: (_, record) => (
        <Button
          type="link"
          onClick={() => {
            setSelectedServer(record);
            setIsDrawerVisible(true);
          }}
        >
          {record.tools?.length || 0} {t('mcp.toolsCount', 'Tools')}
        </Button>
      ),
    },
    {
      title: t('common.action', 'Action'),
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button icon={<SyncOutlined />} size="small" onClick={() => handleRefresh(record._id)}>
            {t('common.refresh', 'Refresh')}
          </Button>
          <Popconfirm
            title={t('mcp.uninstallConfirm', 'Are you sure you want to uninstall?')}
            onConfirm={() => handleDelete(record._id)}
          >
            <Button icon={<DeleteOutlined />} size="small" danger>
              {t('common.uninstall', 'Uninstall')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const content = (
    <div
      style={
        embedded
          ? { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
          : {}
      }
    >
      {!embedded && (
        <div
          style={{
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Space direction="vertical" size={2}>
            <Title level={4} style={{ margin: 0 }}>
              <ApiOutlined /> {t('mcp.title', 'MCP 插件管理')}
            </Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              通过 Model Context Protocol (MCP) 连接外部工具，扩展 AI 智能体的能力。
            </Paragraph>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
            安装插件
          </Button>
        </div>
      )}

      {embedded && (
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
            {t('mcp.installPlugin', 'Install Plugin')}
          </Button>
        </div>
      )}

      <Table
        columns={columns}
        dataSource={data}
        rowKey="_id"
        loading={loading}
        pagination={false}
        scroll={embedded ? { y: 'calc(100vh - 350px)' } : undefined}
      />
      {/* Install Modal */}
      <Modal
        title={t('mcp.installModalTitle', 'Install MCP Service')}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleInstall}>
          <Form.Item label={t('mcp.configMode', 'Config Mode')} name="mode" initialValue="manual">
            <Select onChange={(val) => form.setFieldsValue({ mode: val })}>
              <Select.Option value="manual">{t('mcp.modeManual', 'Manual')}</Select.Option>
              <Select.Option value="json">
                {t('mcp.modeJson', 'Config JSON (Claude/Cursor style)')}
              </Select.Option>
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.mode !== curr.mode}>
            {({ getFieldValue }) => {
              if (getFieldValue('mode') === 'json') {
                return (
                  <Form.Item
                    label={t('mcp.jsonConfigLabel', 'JSON Config Content')}
                    name="configJson"
                    help={t(
                      'mcp.jsonConfigHelp',
                      "Paste mcpServers format JSON. e.g. {'mcpServers': { 'my-server': { ... } }}",
                    )}
                  >
                    <TextArea
                      rows={8}
                      style={{ fontFamily: 'monospace' }}
                      placeholder='{"mcpServers": { ... }}'
                    />
                  </Form.Item>
                );
              }

              return (
                <>
                  <Form.Item
                    label={t('common.label', 'Display Name')}
                    name="label"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder={t('mcp.namePlaceholder', 'e.g. GitHub Agent')} />
                  </Form.Item>
                  <Form.Item
                    label={t('common.id', 'Unique ID (ID)')}
                    name="name"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder={t('mcp.idPlaceholder', 'e.g. github-mcp')} />
                  </Form.Item>
                  <Form.Item
                    label={t('mcp.transportType', 'Transport Protocol')}
                    name="type"
                    initialValue="http"
                  >
                    <Select>
                      <Select.Option value="http">
                        Streamable HTTP ({t('mcp.recommended', 'Recommended, Secure')})
                      </Select.Option>
                      <Select.Option value="stdio">
                        Stdio ({t('mcp.localSubprocess', 'Local Subprocess')})
                      </Select.Option>
                    </Select>
                  </Form.Item>

                  <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
                    {({ getFieldValue }) =>
                      getFieldValue('type') === 'http' ? (
                        <Form.Item
                          label="Endpoint URL"
                          name={['httpConfig', 'url']}
                          rules={[{ required: true }]}
                        >
                          <Input placeholder="https://..." />
                        </Form.Item>
                      ) : (
                        <>
                          <Form.Item
                            label={t('mcp.execCommand', 'Execute Command')}
                            name={['stdioConfig', 'command']}
                            rules={[{ required: true }]}
                          >
                            <Input placeholder="npx" />
                          </Form.Item>
                          <Form.Item
                            label={t('mcp.cmdArgs', 'Command Args (JSON Array)')}
                            name={['stdioConfig', 'argsJson']}
                            initialValue="[]"
                          >
                            <Input placeholder='["-y", "@baidumap/mcp-server-baidu-map"]' />
                          </Form.Item>
                          <Form.Item
                            label={t('mcp.envVars', 'Env Vars (JSON Object)')}
                            name={['stdioConfig', 'envJson']}
                            initialValue="{}"
                          >
                            <Input placeholder='{"API_KEY": "..."}' />
                          </Form.Item>
                        </>
                      )
                    }
                  </Form.Item>
                </>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>

      {/* Tools Drawer */}
      <Drawer
        title={
          <span>
            <ToolOutlined /> 工具列表: {selectedServer?.label}
          </span>
        }
        placement="right"
        onClose={() => setIsDrawerVisible(false)}
        open={isDrawerVisible}
        width={500}
      >
        <List
          itemLayout="vertical"
          dataSource={selectedServer?.tools || []}
          renderItem={(tool) => (
            <List.Item>
              <List.Item.Meta
                avatar={<BugOutlined style={{ color: '#1677ff' }} />}
                title={<Text strong>{tool.name}</Text>}
                description={tool.description}
              />
              <div
                style={{
                  background: '#f5f5f5',
                  padding: '8px 12px',
                  borderRadius: 4,
                  marginTop: 8,
                }}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('mcp.inputSchema', 'Input Schema')}:
                </Text>
                <pre style={{ margin: '4px 0 0 0', fontSize: 11, overflowX: 'auto' }}>
                  {JSON.stringify(tool.inputSchema, null, 2)}
                </pre>
              </div>
            </List.Item>
          )}
        />
        {!selectedServer?.tools?.length && (
          <Text type="secondary">
            {t('mcp.noToolsFound', 'No tools found yet, please try "Refresh".')}
          </Text>
        )}
      </Drawer>
    </div>
  );

  return embedded ? content : <div style={{ padding: 24 }}>{content}</div>;
});

export default McpManagementPage;
