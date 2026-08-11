import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Popconfirm,
  Card,
  message,
  Typography,
  Tag,
  Divider,
  Row,
  Col,
  InputNumber,
  Checkbox,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  BlockOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useOrg } from '../../store/OrgContext';
import PageHeader from '../../components/PageHeader';
import { getWidgets, createWidget, updateWidget, deleteWidget } from '../../api/orgWidgets';
import { getApps } from '../../api/apps';
import { getGlobalRoles } from '../../api/roles';
import { getOrganizationDepartments } from '../../api/departments';
import { getFormsByAppId, getForm } from '../../api/forms';
import * as AntdIcons from '@ant-design/icons';
import { resolveVariables } from '../../utils/VariableResolver';
import { PRESET_VARIABLES } from '../../constants/variables';
import FormRenderer from '../../components/FormRenderer';

const { Text, Title } = Typography;
const { Option } = Select;

const IconSelectModal = ({ open, onSelect, onCancel }) => {
  const [search, setSearch] = useState('');
  const icons = Object.keys(AntdIcons).filter(
    (name) => name.endsWith('Outlined') && name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Modal
      title="选择图标"
      open={open}
      onCancel={onCancel}
      footer={null}
      width={640}
      styles={{ body: { maxHeight: '400px', overflowY: 'auto' } }}
    >
      <Input
        placeholder="搜索图标..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 16 }}
        allowClear
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
          gap: 8,
        }}
      >
        {icons.map((name) => (
          <div
            key={name}
            onClick={() => onSelect(name)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: 8,
              cursor: 'pointer',
              border: '1px solid #f0f0f0',
              borderRadius: 4,
              transition: 'all 0.3s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1890ff')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#f0f0f0')}
          >
            {React.createElement(AntdIcons[name], { style: { fontSize: 24, marginBottom: 4 } })}
            <div style={{ fontSize: 10, textAlign: 'center', color: '#8c8c8c' }}>{name}</div>
          </div>
        ))}
      </div>
    </Modal>
  );
};

const OrgWidgetsPage = () => {
  const { t } = useTranslation();
  const { currentOrganization } = useOrg();
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState([]);
  const [selectedAppForms, setSelectedAppForms] = useState([]);
  const [selectedFormSchema, setSelectedFormSchema] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isIconModalOpen, setIsIconModalOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const fetchWidgets = async () => {
    try {
      setLoading(true);
      const data = await getWidgets();
      setWidgets(data);
    } catch (err) {
      message.error('加载挂件失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchApps = async () => {
    try {
      const data = await getApps();
      setApps(data || []);
    } catch (err) {
      message.error('加载应用列表失败');
    }
  };

  const fetchRoles = async () => {
    try {
      const data = await getGlobalRoles();
      setRoles(data?.roles || data || []);
    } catch (err) {
      console.error('Failed to fetch roles', err);
    }
  };

  const fetchDepartments = async () => {
    const orgId = currentOrganization?.id || currentOrganization?._id;
    if (!orgId) return;
    try {
      const data = await getOrganizationDepartments(orgId);
      const rawDepts = data?.departments || data || [];
      const flattenDepts = (list) => {
        let res = [];
        list.forEach((d) => {
          res.push(d);
          if (d.children?.length) {
            res = res.concat(flattenDepts(d.children));
          }
        });
        return res;
      };
      setDepartments(flattenDepts(rawDepts));
    } catch (err) {
      console.error('Failed to fetch departments', err);
    }
  };

  useEffect(() => {
    fetchWidgets();
    fetchApps();
    fetchRoles();
    fetchDepartments();
  }, [currentOrganization]);

  const handleValuesChange = async (changedValues, allValues) => {
    console.log('onValuesChange:', changedValues);

    // Handle appId change
    if (changedValues.config && changedValues.config.appId !== undefined) {
      const appId = changedValues.config.appId;
      console.log('detected appId change:', appId);

      // Clear schema, formId, and prefillMapping
      setSelectedFormSchema([]);
      form.setFieldsValue({
        config: { ...allValues.config, appId, formId: undefined, url: undefined },
        prefillMapping: [],
      });

      if (appId) {
        try {
          const forms = await getFormsByAppId(appId);
          setSelectedAppForms(forms || []);
        } catch (err) {
          message.error('加载表单列表失败');
        }
      } else {
        setSelectedAppForms([]);
      }
    }

    // Handle formId change
    if (changedValues.config && changedValues.config.formId !== undefined) {
      const formId = changedValues.config.formId;
      const appId = allValues.config?.appId;
      console.log('detected formId change:', { formId, appId });

      // Clear prefillMapping when formId changes
      form.setFieldsValue({ prefillMapping: [] });

      if (formId && appId) {
        try {
          const formData = await getForm(appId, formId);
          console.log('Fetched form schema fields:', formData.fields?.length);
          setSelectedFormSchema(formData.fields || []);
        } catch (err) {
          console.error('Failed to fetch form schema', err);
          setSelectedFormSchema([]);
        }
      } else {
        setSelectedFormSchema([]);
      }
    }
  };

  const handleEdit = async (record) => {
    setEditingWidget(record);

    // Set basic fields first so they are available to handlers
    form.setFieldsValue({
      title: record.title,
      icon: record.icon,
      type: record.type,
      config: record.config,
      priority: record.priority,
      status: record.status,
      visibleToRoles: record.visibleToRoles || [],
      visibleToDepartments: record.visibleToDepartments || [],
    });

    if (record.config?.appId) {
      // Load apps list first
      const forms = await getFormsByAppId(record.config.appId);
      setSelectedAppForms(forms || []);

      if (record.config?.formId) {
        // Use a direct fetch for edit initialization to avoid infinite loop or timing issues
        try {
          const formData = await getForm(record.config.appId, record.config.formId);
          setSelectedFormSchema(formData.fields || []);
        } catch (e) {
          console.error('Edit fetch fields failed', e);
        }
      }
    }

    // Convert prefillMapping Map to array of objects for form list
    const mappingArray = [];
    if (record.config?.prefillMapping) {
      Object.entries(record.config.prefillMapping).forEach(([key, value]) => {
        if (typeof value === 'object') {
          mappingArray.push({
            fieldId: key,
            variable: value.variable,
            hidden: value.hidden,
            readOnly: value.readOnly,
          });
        } else {
          mappingArray.push({ fieldId: key, variable: value });
        }
      });
    }
    form.setFieldsValue({ prefillMapping: mappingArray });

    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteWidget(id);
      message.success('删除成功');
      fetchWidgets();
    } catch (err) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);

      // Convert mapping array back to Map/Object
      const prefillMapping = {};
      if (values.prefillMapping) {
        values.prefillMapping.forEach((item) => {
          if (item.fieldId && item.variable) {
            prefillMapping[item.fieldId] = {
              variable: item.variable,
              hidden: item.hidden || false,
              readOnly: item.readOnly || false,
            };
          }
        });
      }

      const payload = {
        title: values.title,
        icon: values.icon,
        type: values.type,
        priority: values.priority,
        status: values.status,
        visibleToRoles: values.visibleToRoles || [],
        visibleToDepartments: values.visibleToDepartments || [],
        config: {
          ...values.config,
          prefillMapping,
        },
      };

      if (editingWidget) {
        await updateWidget(editingWidget._id, payload);
        message.success('更新成功');
      } else {
        await createWidget(payload);
        message.success('创建成功');
      }
      setIsModalOpen(false);
      fetchWidgets();
    } catch (err) {
      message.error('保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: '挂件名称',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => {
        const Icon = AntdIcons[record.icon] || AntdIcons.BlockOutlined;
        return (
          <Space>
            <Icon style={{ fontSize: 16, color: '#1890ff' }} />
            <Text strong>{text}</Text>
          </Space>
        );
      },
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag color="blue">{type.toUpperCase()}</Tag>,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      sorter: (a, b) => (a.priority || 0) - (b.priority || 0),
      defaultSortOrder: 'descend',
    },
    {
      title: '可见范围',
      key: 'visibility',
      render: (_, record) => {
        const roleNames = (record.visibleToRoles || []).map((id) => {
          const role = roles.find((r) => r.id === id);
          return role ? role.name : id;
        });
        const deptNames = (record.visibleToDepartments || []).map((id) => {
          const dept = departments.find((d) => (d._id || d.id) === id.toString());
          return dept ? dept.name : id;
        });

        if (roleNames.length === 0 && deptNames.length === 0) {
          return <Tag color="default">全员可见</Tag>;
        }

        return (
          <Space orientation="vertical" size={2}>
            {roleNames.length > 0 && (
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                <Text type="secondary">角色: </Text>
                {roleNames.map((name) => (
                  <Tag key={name} color="blue">
                    {name}
                  </Tag>
                ))}
              </div>
            )}
            {deptNames.length > 0 && (
              <div style={{ fontSize: 12 }}>
                <Text type="secondary">部门: </Text>
                {deptNames.map((name) => (
                  <Tag key={name} color="cyan">
                    {name}
                  </Tag>
                ))}
              </div>
            )}
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'ACTIVE' ? 'success' : 'default'}>
          {status === 'ACTIVE' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个挂件吗？"
            onConfirm={() => handleDelete(record._id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="挂件管理"
        // subTitle="配置仪表盘顶部的快捷功能入口"
        extra={[
          <Button
            key="add"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingWidget(null);
              form.resetFields();
              form.setFieldsValue({ status: 'ACTIVE', priority: 0, type: 'form' });
              setIsModalOpen(true);
            }}
          >
            新建挂件
          </Button>,
        ]}
        style={{ borderBottom: '1px solid #f0f0f0' }}
      />

      <div style={{ padding: 24 }}>
        <Table
          columns={columns}
          dataSource={widgets}
          rowKey="_id"
          loading={loading}
          pagination={false}
        />
      </div>

      <Modal
        title={editingWidget ? '编辑挂件' : '新建挂件'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={800}
        styles={{
          body: { maxHeight: 'calc(100vh - 250px)', overflowY: 'auto', padding: '16px 24px' },
        }}
        destroyOnClose
        forceRender
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          onValuesChange={handleValuesChange}
          initialValues={{ status: 'ACTIVE', priority: 0, type: 'form' }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="title"
                label="挂件标题"
                rules={[{ required: true, message: '请输入标题' }]}
              >
                <Input placeholder="例如：意见反馈" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="icon" label="图标">
                <Input
                  prefix={
                    form && form.getFieldValue('icon')
                      ? React.createElement(AntdIcons[form.getFieldValue('icon')])
                      : null
                  }
                  placeholder="点击选择图标"
                  readOnly
                  onClick={() => setIsIconModalOpen(true)}
                  style={{ cursor: 'pointer' }}
                  suffix={<AntdIcons.SearchOutlined />}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="type" label="类型" rules={[{ required: true }]}>
                <Select>
                  <Option value="form">表单挂件</Option>
                  <Option value="link">链接挂件</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="priority" label="显示优先级">
                <InputNumber min={0} placeholder="数字越大越靠前" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              return (
                <Row gutter={16}>
                  {type === 'form' && (
                    <Col span={12}>
                      <Form.Item
                        name={['config', 'displayStyle']}
                        label="展现方式"
                        initialValue="drawer"
                        rules={[{ required: true }]}
                      >
                        <Select>
                          <Option value="drawer">抽屉 (Drawer)</Option>
                          <Option value="modal">弹窗 (Modal)</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  )}
                  <Col span={type === 'form' ? 12 : 24}>
                    <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                      <Select>
                        <Option value="ACTIVE">启用</Option>
                        <Option value="INACTIVE">禁用</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              );
            }}
          </Form.Item>

          <Card size="small" title="可见范围" style={{ background: '#fafafa', marginBottom: 24 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="visibleToRoles" label="可见角色" extra="留空表示所有角色可见">
                  <Select
                    mode="multiple"
                    placeholder="选择角色"
                    allowClear
                    showSearch
                    optionFilterProp="children"
                  >
                    {roles.map((r) => (
                      <Option key={r.id} value={r.id}>
                        {r.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="visibleToDepartments"
                  label="可见部门"
                  extra="留空表示所有部门可见"
                >
                  <Select
                    mode="multiple"
                    placeholder="选择部门"
                    allowClear
                    showSearch
                    optionFilterProp="children"
                  >
                    {departments.map((d) => (
                      <Option key={d._id || d.id} value={d._id || d.id}>
                        {d.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Text type="secondary" style={{ fontSize: 12 }}>
              提示：用户只要满足“指定角色”或“指定部门”中的任意一项即可看到该挂件。全部留空则对组织全员可见。
            </Text>
          </Card>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              if (type === 'form') {
                return (
                  <Card size="small" title="表单配置" style={{ background: '#fafafa' }}>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name={['config', 'appId']}
                          label="所属应用"
                          rules={[{ required: true, message: '请选择应用' }]}
                        >
                          <Select
                            placeholder="选择表单所在的应用"
                            showSearch
                            filterOption={(input, option) =>
                              (option?.children ?? '').toLowerCase().indexOf(input.toLowerCase()) >=
                              0
                            }
                          >
                            {apps.map((app) => (
                              <Option key={app._id} value={app._id}>
                                {app.name}
                              </Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name={['config', 'formId']}
                          label="关联表单"
                          rules={[{ required: true, message: '请选择表单' }]}
                        >
                          <Select placeholder="选择要展示的表单">
                            {selectedAppForms.map((f) => (
                              <Option key={f._id} value={f._id}>
                                {f.name}
                              </Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>

                    <Divider orientation="left" plain>
                      数据预填映射 (Prefill Mapping)
                    </Divider>
                    <Text
                      type="secondary"
                      style={{ fontSize: 12, display: 'block', marginBottom: 12 }}
                    >
                      将系统变量自动填入表单中的指定字段。
                    </Text>

                    <Form.List name="prefillMapping">
                      {(fields, { add, remove }) => (
                        <>
                          {fields.map(({ key, name, ...restField }) => (
                            <Space
                              key={key}
                              style={{ display: 'flex', marginBottom: 8 }}
                              align="baseline"
                            >
                              <Form.Item
                                {...restField}
                                name={[name, 'fieldId']}
                                rules={[{ required: true, message: '请选择字段' }]}
                                style={{ width: 220 }}
                              >
                                <Select placeholder="选择表单字段" showSearch>
                                  {selectedFormSchema.map((field) => (
                                    <Option key={field.id} value={field.id}>
                                      {field.properties?.label || field.id}
                                    </Option>
                                  ))}
                                </Select>
                              </Form.Item>
                              <Form.Item
                                {...restField}
                                name={[name, 'variable']}
                                rules={[{ required: true, message: '请选择或输入变量' }]}
                                style={{ width: 220 }}
                              >
                                <Select showSearch placeholder="选择系统变量">
                                  {PRESET_VARIABLES.map((v) => (
                                    <Option key={v.value} value={v.value}>
                                      {v.label}
                                    </Option>
                                  ))}
                                </Select>
                              </Form.Item>
                              <Form.Item
                                {...restField}
                                name={[name, 'hidden']}
                                valuePropName="checked"
                                style={{ marginBottom: 0 }}
                              >
                                <Checkbox>隐藏</Checkbox>
                              </Form.Item>
                              <Form.Item
                                {...restField}
                                name={[name, 'readOnly']}
                                valuePropName="checked"
                                style={{ marginBottom: 0 }}
                              >
                                <Checkbox>只读</Checkbox>
                              </Form.Item>
                              <Button
                                type="text"
                                danger
                                onClick={() => remove(name)}
                                icon={<DeleteOutlined />}
                              />
                            </Space>
                          ))}
                          <Form.Item>
                            <Button
                              type="dashed"
                              onClick={() => add()}
                              block
                              icon={<PlusOutlined />}
                            >
                              新增映射关系
                            </Button>
                          </Form.Item>
                        </>
                      )}
                    </Form.List>
                  </Card>
                );
              } else if (type === 'link') {
                return (
                  <Card size="small" title="链接配置" style={{ background: '#fafafa' }}>
                    <Form.Item
                      name={['config', 'url']}
                      label="目标 URL"
                      rules={[
                        { required: true, message: '请输入目标跳转 URL' },
                        { type: 'url', message: '请输入有效的 URL' },
                      ]}
                    >
                      <Input
                        placeholder="https://example.com"
                        prefix={<AntdIcons.LinkOutlined />}
                      />
                    </Form.Item>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      点击挂件后将会在新窗口中打开此链接。
                    </Text>
                  </Card>
                );
              }
              return null;
            }}
          </Form.Item>
        </Form>
      </Modal>

      <IconSelectModal
        open={isIconModalOpen}
        onCancel={() => setIsIconModalOpen(false)}
        onSelect={(icon) => {
          form.setFieldsValue({ icon });
          setIsIconModalOpen(false);
        }}
      />
    </>
  );
};

export default OrgWidgetsPage;
