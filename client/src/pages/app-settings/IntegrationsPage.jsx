import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Typography,
  Tooltip,
  Popconfirm,
  Card,
  Layout,
} from 'antd';
import {
  ApiOutlined,
  PlusOutlined,
  DingtalkOutlined,
  SettingOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getAppChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  testChannelConnection,
} from '../../api/channels';
import { getDigitalEmployees } from '../../api/digital-employees';
import { getWorkflows } from '../../api/workflow';
import PageHeader from '../../components/PageHeader';

const { Text } = Typography;
const { Option } = Select;
const { Content } = Layout;

const IntegrationsPage = () => {
  const { appId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [channels, setChannels] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [form] = Form.useForm();

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const [channelsRes, employeesRes] = await Promise.all([
        getAppChannels(appId),
        getDigitalEmployees(appId),
      ]);
      setChannels(channelsRes || []);
      setEmployees(employeesRes || []);
    } catch (err) {
      message.error('Failed to load integration data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [appId]);

  const handleCreate = () => {
    setEditingChannel(null);
    form.resetFields();
    form.setFieldsValue({ providerId: 'dingtalk', status: 'ACTIVE' });
    setIsModalOpen(true);
  };

  const handleEdit = (channel) => {
    setEditingChannel(channel);
    form.resetFields();
    form.setFieldsValue({
      name: channel.name,
      providerId: channel.providerId,
      status: channel.status,
      employeeId: channel.employeeId,
      ...(channel.config || {}),
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    setLoading(true);
    try {
      await deleteChannel(id);
      setChannels((prev) => prev.filter((c) => (c.id || c._id) !== id));
      message.success('Integration removed');
    } catch (err) {
      message.error('Delete failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const { name, providerId, status, employeeId, ...config } = values;

      const payload = {
        name,
        providerId,
        status,
        employeeId: employeeId || null,
        appId,
        config,
      };

      setLoading(true);
      if (editingChannel) {
        const updated = await updateChannel(editingChannel.id, payload);
        setChannels((prev) =>
          prev.map((c) =>
            (c.id || c._id) === (editingChannel.id || editingChannel._id)
              ? { ...c, ...updated }
              : c,
          ),
        );
        message.success('Integration updated');
      } else {
        const created = await createChannel(payload);
        setChannels((prev) => [created, ...prev]);
        message.success('Integration created');
      }

      setIsModalOpen(false);
    } catch (err) {
      // Validation error
    } finally {
      setLoading(false);
    }
  };

  const handleTestStatus = async (id) => {
    try {
      message.loading({ content: 'Testing connection...', key: 'test-conn' });
      const res = await testChannelConnection(id);
      if (res?.connected) {
        message.success({ content: 'Connection active and healthy', key: 'test-conn' });
      } else {
        message.warning({ content: 'Provider is offline or not responsive', key: 'test-conn' });
      }
    } catch (err) {
      message.error({ content: 'Test failed: Connection error', key: 'test-conn' });
    }
  };

  const PROVIDER_ICONS = {
    dingtalk: <DingtalkOutlined style={{ color: '#1890ff' }} />,
    wetinker: <ApiOutlined style={{ color: '#52c41a' }} />,
    generic: <ApiOutlined />,
  };

  const columns = [
    {
      title: '渠道名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          {PROVIDER_ICONS[record.providerId] || PROVIDER_ICONS.generic}
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '平台类型',
      dataIndex: 'providerId',
      key: 'providerId',
      render: (providerId) => (
        <Tag color={providerId === 'dingtalk' ? 'blue' : 'default'}>{providerId.toUpperCase()}</Tag>
      ),
    },
    {
      title: '绑定数字员工',
      dataIndex: 'employeeId',
      key: 'employeeId',
      render: (employeeId, record) => {
        if (record.providerId === 'wetinker') {
          return <Text type="secondary">-</Text>;
        }
        const emp = employees.find((e) => (e.id || e._id) === employeeId);
        return emp ? <Tag color="cyan">{emp.name}</Tag> : <Text type="secondary">未绑定</Text>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => (
        <Switch
          size="small"
          checked={status === 'ACTIVE'}
          onChange={async (checked) => {
            const newStatus = checked ? 'ACTIVE' : 'INACTIVE';
            setLoading(true);
            try {
              const updated = await updateChannel(record.id, { status: newStatus });
              setChannels((prev) =>
                prev.map((c) =>
                  (c.id || c._id) === (record.id || record._id) ? { ...c, ...updated } : c,
                ),
              );
              message.success(`Integration ${checked ? 'enabled' : 'disabled'}`);
            } catch (err) {
              message.error('Failed to update status');
            } finally {
              setLoading(false);
            }
          }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="测试连接">
            <Button
              type="text"
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => handleTestStatus(record.id)}
            />
          </Tooltip>
          <Button
            type="link"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => handleEdit(record)}
          >
            设置
          </Button>
          <Popconfirm title="确定删除此集成吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Layout style={{ height: '100vh', background: '#fff' }}>
      <PageHeader
        onBack={() => navigate(`/apps/${appId}`)}
        title="AI网关"
        showUser
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建渠道
          </Button>
        }
      />

      <Content style={{ padding: 24, overflow: 'auto' }}>
        <Table
          columns={columns}
          dataSource={channels}
          rowKey={(record) => record.id || record._id}
          loading={loading}
          pagination={false}
          size="middle"
        />
      </Content>

      <Modal
        title={editingChannel ? '编辑渠道' : '新建渠道'}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
        width={600}
        destroyOnClose
        confirmLoading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ providerId: 'dingtalk', status: 'ACTIVE' }}
        >
          <Form.Item
            name="name"
            label="渠道名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="例如：钉钉客服渠道" />
          </Form.Item>

          <Form.Item name="providerId" label="平台类型" rules={[{ required: true }]}>
            <Select disabled={!!editingChannel}>
              <Option value="dingtalk">钉钉 (Stream 互动卡片)</Option>
              <Option value="wetinker">WeTinker</Option>
              <Option value="slack" disabled>
                Slack (即将推出)
              </Option>
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.providerId !== curr.providerId}>
            {({ getFieldValue }) => {
              const providerId = getFieldValue('providerId');
              if (providerId === 'wetinker') return null; // WeTinker uses tagRoutes and has no global default employee select
              return (
                <Form.Item
                  name="employeeId"
                  label="绑定数字员工"
                  rules={[{ required: true, message: '请选择要绑定的数字员工' }]}
                  extra="渠道收到消息后，将由该数字员工负责响应，自动沿用其性格和逻辑配置。"
                >
                  <Select placeholder="选择一个数字员工" allowClear>
                    {employees.map((emp) => (
                      <Option key={emp.id || emp._id} value={emp.id || emp._id}>
                        {emp.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item
            name="status"
            label="初始状态"
            valuePropName="checked"
            getValueFromEvent={(e) => (e ? 'ACTIVE' : 'INACTIVE')}
            getValueProps={(v) => ({ checked: v === 'ACTIVE' })}
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Card
            size="small"
            title="平台参数配置"
            headStyle={{ background: '#fafafa' }}
            style={{ marginTop: 16 }}
          >
            <Form.Item shouldUpdate={(prev, curr) => prev.providerId !== curr.providerId}>
              {({ getFieldValue }) => {
                const providerId = getFieldValue('providerId');
                if (providerId === 'dingtalk') {
                  return (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Form.Item
                        name="clientId"
                        label="App Key (ClientId)"
                        rules={[{ required: true, message: '请输入 App Key' }]}
                      >
                        <Input placeholder="钉钉应用的 AppKey" />
                      </Form.Item>
                      <Form.Item
                        name="clientSecret"
                        label="App Secret"
                        rules={[{ required: true, message: '请输入 App Secret' }]}
                      >
                        <Input.Password placeholder="钉钉应用的 AppSecret" />
                      </Form.Item>
                      <Form.Item
                        name="templateId"
                        label="互动卡片模板 ID"
                        rules={[{ required: true, message: '请输入模板 ID' }]}
                      >
                        <Input placeholder="在卡片平台创建的模板 ID" />
                      </Form.Item>
                    </Space>
                  );
                }
                if (providerId === 'wetinker') {
                  return (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Form.Item
                        name="appId"
                        label="App ID"
                        rules={[{ required: true, message: '请输入 App ID' }]}
                      >
                        <Input placeholder="WeTinker appId" />
                      </Form.Item>
                      <Form.Item
                        name="accountIds"
                        label="账号 ID"
                        extra="多个账号 ID 请以 | 或 , 分隔"
                        rules={[{ required: true, message: '请输入账号 ID' }]}
                      >
                        <Input.TextArea placeholder="例如: ID1,ID2" />
                      </Form.Item>
                      <Form.Item
                        name="channelId"
                        label="发消息的ChannelId"
                        rules={[{ required: true, message: '请输入 ChannelId' }]}
                      >
                        <Input placeholder="例如: 12345" />
                      </Form.Item>
                      <Form.Item label="按标签路由数字员工 (Tag Routes)">
                        <Form.List name="tagRoutes">
                          {(fields, { add, remove }) => (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {fields.map(({ key, name, ...restField }) => (
                                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                  <Form.Item
                                    {...restField}
                                    name={[name, 'employeeId']}
                                    rules={[{ required: true, message: '请选择员工' }]}
                                    style={{ margin: 0, width: 200 }}
                                  >
                                    <Select placeholder="选择数字员工">
                                      {employees.map((emp) => (
                                        <Option key={emp.id || emp._id} value={emp.id || emp._id}>
                                          {emp.name}
                                        </Option>
                                      ))}
                                    </Select>
                                  </Form.Item>
                                  <Form.Item
                                    {...restField}
                                    name={[name, 'tags']}
                                    rules={[{ required: true, message: '标签名' }]}
                                    style={{ margin: 0, width: 220 }}
                                  >
                                    <Input placeholder="标签，多个以 | 分隔，* 兜底" />
                                  </Form.Item>
                                  <Button type="link" danger onClick={() => remove(name)}>
                                    删除
                                  </Button>
                                </Space>
                              ))}
                              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                添加标签路由规则
                              </Button>
                            </div>
                          )}
                        </Form.List>
                      </Form.Item>
                    </Space>
                  );
                }
                return <Text type="secondary">此提供商暂无特殊配置项</Text>;
              }}
            </Form.Item>
          </Card>
        </Form>
      </Modal>
    </Layout>
  );
};

export default IntegrationsPage;
