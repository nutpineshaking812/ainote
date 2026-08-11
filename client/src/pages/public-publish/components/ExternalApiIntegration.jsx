import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  Typography,
  Space,
  Switch,
  Button,
  Table,
  Modal,
  Form,
  Input,
  DatePicker,
  message,
  Popconfirm,
  Checkbox,
  Tooltip,
  Card,
  Tag,
  Radio,
  Result,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
  CodeOutlined,
  ClockCircleOutlined,
  QuestionCircleOutlined,
  ApiOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  getExternalApiConfig,
  updateExternalApiStatus,
  createExternalApiToken,
  updateExternalApiToken,
  deleteExternalApiToken,
} from '../../../api/publish';
import PageHeader from '../../../components/PageHeader';
import XMarkdownDisplay from '../../../components/common/XMarkdownDisplay';
import FormBuilderContext from '../../../contexts/FormBuilderContext';
import ResizableDrawer from '../../../components/common/ResizableDrawer';
import { API_URL } from '../../../api/index';

const { Text, Paragraph } = Typography;

// --- 辅助工具函数 ---

/**
 * 生成代码示例片段
 */
const getCodeSnippet = (formId, token, fields, type = 'submit', lang = 'javascript') => {
  // 使用统一的 API_URL,如果是相对路径(如 /api/v1),则补充当前 origin
  const getFullUrl = (path) => {
    if (API_URL.startsWith('http')) return `${API_URL}${path}`;
    return `${window.location.origin}${API_URL}${path}`;
  };

  const baseUrl = getFullUrl(`/ext`);
  const exampleRecordId = '678227b68a73b9e4a3...';

  // 通用示例数据生成
  const generateExampleData = () => {
    const data = {};
    fields.slice(0, 5).forEach((field) => {
      if (field.recordable !== false) {
        data[field.id || field._id] = field.type === 'number' ? 123 : '示例值';
      }
    });
    return data;
  };

  if (type === 'submit') {
    const bodyObj = { data: generateExampleData() };

    if (lang === 'curl') {
      const singleLineBody = JSON.stringify(bodyObj);
      return `curl -X POST "${baseUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-Form-Token: ${token}" \\
  -d '${singleLineBody}'`;
    }

    return `fetch("${baseUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Form-Token": "${token}"
  },
  body: JSON.stringify(${JSON.stringify(bodyObj, null, 2)})
})
.then(res => res.json())
.then(console.log);`;
  }

  if (type === 'update') {
    const bodyObj = { data: generateExampleData() };
    const updateUrl = `${baseUrl}/${exampleRecordId}`;

    if (lang === 'curl') {
      const singleLineBody = JSON.stringify(bodyObj);
      return `curl -X POST "${updateUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-Form-Token: ${token}" \\
  -d '${singleLineBody}'`;
    }

    return `fetch("${updateUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Form-Token": "${token}"
  },
  body: JSON.stringify(${JSON.stringify(bodyObj, null, 2)})
})
.then(res => res.json())
.then(console.log);`;
  }

  if (type === 'delete') {
    const deleteUrl = `${baseUrl}/${exampleRecordId}/delete`;

    if (lang === 'curl') {
      return `curl -X POST "${deleteUrl}" \\
  -H "X-Form-Token: ${token}"`;
    }

    return `fetch("${deleteUrl}", {
  method: "POST",
  headers: {
    "X-Form-Token": "${token}"
  }
})
.then(res => res.json())
.then(console.log);`;
  }

  // query type
  if (lang === 'curl') {
    return `curl -X GET "${baseUrl}?page=1&limit=10" \\
  -H "X-Form-Token: ${token}"`;
  }

  return `fetch("${baseUrl}?page=1&limit=10", {
  method: "GET",
  headers: {
    "X-Form-Token": "${token}"
  }
})
.then(res => res.json())
.then(console.log);`;
};

/**
 * 生成完整的 Markdown 说明文档
 */
const generateMarkdownDoc = (formId, fields, token, permissions) => {
  const hasRead = permissions.includes('READ');
  const hasWrite = permissions.includes('WRITE');

  const exampleRecordData = {};
  fields.slice(0, 5).forEach((field) => {
    if (field.recordable !== false) {
      exampleRecordData[field.id || field._id] = field.type === 'number' ? 123 : '示例值';
    }
  });

  const fieldsRows = fields
    .filter((f) => f.recordable !== false)
    .map((f) => {
      const isRequired = f.validation?.required ? '✅ 是' : '—';
      const name = f.properties?.label || '未命名';
      let remark = '';

      // 提取可选项 (如 select, radio, checkbox 等)
      const options = f.properties?.options;
      if (Array.isArray(options) && options.length > 0) {
        const optionText = options
          .map((opt) => (typeof opt === 'string' ? opt : `<li>${opt.value}(${opt.label})</li>`))
          .join('');
        remark += `可选项: <ul>${optionText}</ul>`;
      }

      // 提取校验规则
      const v = f.validation || {};
      const rules = [];
      if (v.min !== undefined) rules.push(`最小值: ${v.min}`);
      if (v.max !== undefined) rules.push(`最大值: ${v.max}`);
      if (v.minLength !== undefined) rules.push(`最小长度: ${v.minLength}`);
      if (v.maxLength !== undefined) rules.push(`最大长度: ${v.maxLength}`);
      if (v.pattern)
        rules.push(
          `格式匹配 (正则): \`${v.pattern}\`${v.patternMessage ? ` (${v.patternMessage})` : ''}`,
        );

      if (rules.length > 0) {
        remark += `校验规则: <ul>${rules.map((r) => `<li>${r}</li>`).join('')}</ul>`;
      }

      return `| \`${f.id || f._id}\` | ${name} | \`${f.type}\` | ${isRequired} | ${remark} |`;
    })
    .join('\n');

  return `
# 🛠️ 字段与格式规范

> 在使用以下接口进行对接前，请务必仔细阅读此规范。

### 通用格式要求
- **日期/时间**: 请使用 ISO 8601 格式字符串 (如 \`2024-01-01T12:00:00Z\`)。
- **单选/下拉**: 使用选项对应的 \`value\` 值。
- **多选/附件**: 使用数组格式 \`["val1", "val2"]\`。

### 数据项规范 (Field Specification)
<details open>
<summary>点击查看详细字段定义</summary>

| 字段 ID | 名称 | 类型 | 必填 | 格式/备注 |
| :--- | :--- | :--- | :--- | :--- |
${fieldsRows}

</details>

---

${
  hasWrite
    ? `
# 📤 数据提交

> **接口用途**: 将外部数据实时推送到此表单中。

所有数据项必须封装在请求体的 \`data\` 对象中,并使用上方列表中的 **字段 ID** 作为键。

### 提交示例

<details>
<summary><b>Javascript (Fetch)</b></summary>

\`\`\`javascript
${getCodeSnippet(formId, token, fields, 'submit', 'javascript')}
\`\`\`

</details>

<details open>
<summary><b>cURL</b></summary>

\`\`\`bash
${getCodeSnippet(formId, token, fields, 'submit', 'curl')}
\`\`\`

</details>

### 响应数据格式
<details>
<summary>点击查看响应示例</summary>

\`\`\`json
{
  "success": true,
  "data": {
    "id": "678227b68a73b9e4a3..."
  }
}
\`\`\`

</details>

---
`
    : ''
}

${
  hasRead
    ? `
# 📥 数据获取

> **接口用途**: 获取此表单下已提交的原始数据记录。

### 查询示例

<details>
<summary><b>Javascript (Fetch)</b></summary>

\`\`\`javascript
${getCodeSnippet(formId, token, fields, 'query', 'javascript')}
\`\`\`

</details>

<details open>
<summary><b>cURL</b></summary>

\`\`\`bash
${getCodeSnippet(formId, token, fields, 'query', 'curl')}
\`\`\`

</details>

### 响应数据格式
<details>
<summary>点击查看响应示例</summary>

\`\`\`json
{
  "success": true,
  "data": {
    "records": [
      {
        "_id": "678227b68a73b9e4a3...",
        "data": ${JSON.stringify(exampleRecordData, null, 2).split('\n').join('\n        ')},
        "createdAt": "2024-01-01T12:00:00.000Z",
        "submitSource": "EXTERNAL_API",
        "sourceTokenName": "默认令牌"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  }
}
\`\`\`

</details>

---
`
    : ''
}

${
  permissions.includes('UPDATE')
    ? `
# 📝 数据更新

> **接口用途**: 更新指定 ID 的数据记录。

该接口通过替换方式更新记录中的 \`data\` 字段。

### 更新示例

<details>
<summary><b>Javascript (Fetch)</b></summary>

\`\`\`javascript
${getCodeSnippet(formId, token, fields, 'update', 'javascript')}
\`\`\`

</details>

<details open>
<summary><b>cURL</b></summary>

\`\`\`bash
${getCodeSnippet(formId, token, fields, 'update', 'curl')}
\`\`\`

</details>

### 响应数据格式
<details>
<summary>点击查看响应示例</summary>

\`\`\`json
{
  "success": true,
  "data": {
    "_id": "678227b68a73b9e4a3...",
    "data": ${JSON.stringify(exampleRecordData, null, 2).split('\n').join('\n    ')}
  }
}
\`\`\`

</details>

---

`
    : ''
}

${
  permissions.includes('DELETE')
    ? `
# 🗑️ 数据删除

> **接口用途**: 删除指定 ID 的数据记录。

### 删除示例

<details>
<summary><b>Javascript (Fetch)</b></summary>

\`\`\`javascript
${getCodeSnippet(formId, token, fields, 'delete', 'javascript')}
\`\`\`

</details>

<details open>
<summary><b>cURL</b></summary>

\`\`\`bash
${getCodeSnippet(formId, token, fields, 'delete', 'curl')}
\`\`\`

</details>

### 响应数据格式
<details>
<summary>点击查看响应示例</summary>

\`\`\`json
{
  "success": true,
  "data": {
    "message": "Record deleted successfully"
  }
}
\`\`\`

</details>

---
`
    : ''
}
`.trim();
};

// --- 子组件 ---

/**
 * 令牌管理表格
 */
const TokenTable = ({ tokens, loading, onShowCode, onDelete, onEdit, onCopyToken }) => {
  const containerRef = React.useRef(null);
  const [tableScrollY, setTableScrollY] = useState(400);

  useEffect(() => {
    const updateTableHeight = () => {
      if (containerRef.current) {
        const containerHeight = containerRef.current.clientHeight;
        const scrollY = Math.max(containerHeight - 55, 200);
        setTableScrollY(scrollY);
      }
    };

    updateTableHeight();
    const resizeObserver = new ResizeObserver(updateTableHeight);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', updateTableHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateTableHeight);
    };
  }, []);

  const columns = useMemo(
    () => [
      { title: '名称', dataIndex: 'name', key: 'name', width: 150 },
      {
        title: '令牌 (Token)',
        dataIndex: 'token',
        key: 'token',
        width: 250,
        render: (text) => (
          <Space>
            <Text code>{text.substring(0, 12)}...</Text>
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => onCopyToken(text)}
            />
          </Space>
        ),
      },
      {
        title: '权限范围',
        dataIndex: 'permissions',
        key: 'permissions',
        width: 150,
        render: (perms = []) => (
          <Space>
            {perms.includes('READ') && <Tag color="blue">READ</Tag>}
            {perms.includes('WRITE') && <Tag color="orange">WRITE</Tag>}
            {perms.includes('UPDATE') && <Tag color="cyan">UPDATE</Tag>}
            {perms.includes('DELETE') && <Tag color="red">DELETE</Tag>}
          </Space>
        ),
      },
      {
        title: '有效期',
        dataIndex: 'expiresAt',
        key: 'expiresAt',
        width: 200,
        render: (text) => {
          if (!text) return <Tag color="green">永久有效</Tag>;
          const isExpired = dayjs(text).isBefore(dayjs());
          return (
            <Tag
              color={isExpired ? 'error' : 'warning'}
              icon={isExpired ? <ClockCircleOutlined /> : null}
            >
              {dayjs(text).format('YYYY-MM-DD HH:mm')} {isExpired && '(已过期)'}
            </Tag>
          );
        },
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm'),
      },
      {
        title: '操作',
        key: 'action',
        width: 150,
        render: (_, record) => (
          <Space size="middle">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(record)}>
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              icon={<CodeOutlined />}
              onClick={() => onShowCode(record.token, record.permissions)}
            >
              示例
            </Button>
            <Popconfirm
              title="确认删除该令牌?"
              onConfirm={() => onDelete(record._id || record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [onCopyToken, onDelete, onEdit, onShowCode],
  );

  return (
    <div ref={containerRef} style={{ flex: 1, minHeight: 0 }}>
      <Table
        columns={columns}
        dataSource={tokens}
        rowKey={(record) => record._id || record.id}
        pagination={false}
        loading={loading}
        scroll={{ x: 'max-content', y: tableScrollY }}
      />
    </div>
  );
};

/**
 * 新建令牌对话框
 */
const CreateTokenModal = ({ visible, onCancel, onSubmit, submitting }) => {
  const [form] = Form.useForm();

  const handleOk = () => form.submit();
  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="新建外部集成令牌"
      open={visible}
      onCancel={handleCancel}
      onOk={handleOk}
      confirmLoading={submitting}
      okText="创建"
      cancelText="取消"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => {
          onSubmit(values);
          form.resetFields();
        }}
      >
        <Form.Item
          name="name"
          label="令牌名称"
          rules={[{ required: true, message: '请填写令牌名称' }]}
          initialValue="默认令牌"
        >
          <Input placeholder="例如:用户反馈模块、落地页A" />
        </Form.Item>
        <Form.Item
          name="permissions"
          label="权限范围"
          rules={[{ required: true, message: '请至少选择一个权限' }]}
          initialValue={['WRITE']}
        >
          <Checkbox.Group>
            <Space>
              <Checkbox value="WRITE">数据提交 (WRITE)</Checkbox>
              <Checkbox value="READ">数据查询 (READ)</Checkbox>
              <Checkbox value="UPDATE">数据更新 (UPDATE)</Checkbox>
              <Checkbox value="DELETE">数据删除 (DELETE)</Checkbox>
            </Space>
          </Checkbox.Group>
        </Form.Item>
        <Form.Item name="expirationType" label="过期设置" initialValue="permanent">
          <Radio.Group>
            <Radio value="permanent">永不过期</Radio>
            <Radio value="custom">设置过期时间</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          noStyle
          shouldUpdate={(prev, curr) => prev.expirationType !== curr.expirationType}
        >
          {({ getFieldValue }) =>
            getFieldValue('expirationType') === 'custom' && (
              <Form.Item
                name="expiresAt"
                label="过期时间"
                rules={[{ required: true, message: '请选择过期时间' }]}
              >
                <DatePicker showTime style={{ width: '100%' }} placeholder="选择过期时间" />
              </Form.Item>
            )
          }
        </Form.Item>
      </Form>
    </Modal>
  );
};

/**
 * 编辑令牌模态框
 */
const EditTokenModal = ({ visible, token, onCancel, onSubmit, submitting }) => {
  const [form] = Form.useForm();

  // 当 token 变化时更新表单值
  useEffect(() => {
    if (token && visible) {
      const expirationType = token.expiresAt ? 'custom' : 'permanent';
      form.setFieldsValue({
        name: token.name,
        permissions: token.permissions || ['WRITE'],
        expirationType,
        expiresAt: token.expiresAt ? dayjs(token.expiresAt) : null,
      });
    }
  }, [token, visible, form]);

  const handleOk = () => form.submit();
  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="编辑外部集成令牌"
      open={visible}
      onCancel={handleCancel}
      onOk={handleOk}
      confirmLoading={submitting}
      okText="保存"
      cancelText="取消"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => {
          onSubmit(values);
        }}
      >
        <Form.Item
          name="name"
          label="令牌名称"
          rules={[{ required: true, message: '请填写令牌名称' }]}
        >
          <Input placeholder="例如:用户反馈模块、落地页A" />
        </Form.Item>
        <Form.Item
          name="permissions"
          label="权限范围"
          rules={[{ required: true, message: '请至少选择一个权限' }]}
        >
          <Checkbox.Group>
            <Space>
              <Checkbox value="WRITE">数据提交 (WRITE)</Checkbox>
              <Checkbox value="READ">数据查询 (READ)</Checkbox>
              <Checkbox value="UPDATE">数据更新 (UPDATE)</Checkbox>
              <Checkbox value="DELETE">数据删除 (DELETE)</Checkbox>
            </Space>
          </Checkbox.Group>
        </Form.Item>
        <Form.Item name="expirationType" label="过期设置">
          <Radio.Group>
            <Radio value="permanent">永不过期</Radio>
            <Radio value="custom">设置过期时间</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          noStyle
          shouldUpdate={(prev, curr) => prev.expirationType !== curr.expirationType}
        >
          {({ getFieldValue }) =>
            getFieldValue('expirationType') === 'custom' && (
              <Form.Item
                name="expiresAt"
                label="过期时间"
                rules={[{ required: true, message: '请选择过期时间' }]}
              >
                <DatePicker showTime style={{ width: '100%' }} placeholder="选择过期时间" />
              </Form.Item>
            )
          }
        </Form.Item>
      </Form>
    </Modal>
  );
};

// --- 主组件 ---

const ExternalApiIntegration = ({ formId }) => {
  const { appId } = useParams();
  const { formData } = useContext(FormBuilderContext);

  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingToken, setEditingToken] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [markdownContent, setMarkdownContent] = useState('');

  const fields = useMemo(() => formData?.fields || [], [formData]);

  const loadConfig = async () => {
    if (!appId || !formId) return;
    setLoading(true);
    try {
      const data = await getExternalApiConfig(appId, formId);
      setEnabled(data.enabled || false);
      setTokens(data.tokens || []);
    } catch (e) {
      console.error(e);
      message.error('加载对接配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [appId, formId]);

  const handleToggleStatus = async (checked) => {
    try {
      await updateExternalApiStatus(appId, formId, checked);
      setEnabled(checked);
      message.success(checked ? '外部 API 已开启' : '外部 API 已关闭');
    } catch (e) {
      console.error(e);
      message.error('更新状态失败');
    }
  };

  const handleAddToken = async (values) => {
    setSubmitting(true);
    try {
      await createExternalApiToken(appId, formId, {
        name: values.name,
        permissions: values.permissions,
        expiresAt:
          values.expirationType === 'custom' && values.expiresAt
            ? values.expiresAt.toISOString()
            : null,
      });
      message.success('令牌创建成功');
      setIsModalVisible(false);
      loadConfig();
    } catch (e) {
      console.error(e);
      message.error('创建令牌失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteToken = async (tokenId) => {
    try {
      await deleteExternalApiToken(appId, formId, tokenId);
      message.success('令牌已删除');
      loadConfig();
    } catch (e) {
      console.error(e);
      message.error('删除令牌失败');
    }
  };

  const handleEditToken = (token) => {
    setEditingToken(token);
    setIsEditModalVisible(true);
  };

  const handleUpdateToken = async (values) => {
    if (!editingToken) return;
    setSubmitting(true);
    try {
      await updateExternalApiToken(appId, formId, editingToken._id || editingToken.id, {
        name: values.name,
        permissions: values.permissions,
        expiresAt:
          values.expirationType === 'custom' && values.expiresAt
            ? values.expiresAt.toISOString()
            : null,
      });
      message.success('令牌更新成功');
      setIsEditModalVisible(false);
      setEditingToken(null);
      loadConfig();
    } catch (e) {
      console.error(e);
      message.error('更新令牌失败');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text, msg = '令牌已复制') => {
    navigator.clipboard.writeText(text);
    message.success(msg);
  };

  const showCodeDrawer = (token, permissions) => {
    const markdown = generateMarkdownDoc(formId, fields, token, permissions);
    setMarkdownContent(markdown);
    setDrawerVisible(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        title="API 对接"
        extra={
          <Tooltip title="开启外部 API 后,你可以生成专用的令牌 (Token),并在第三方系统向本表单提交数据。">
            <QuestionCircleOutlined style={{ color: '#1890ff', cursor: 'help', fontSize: 16 }} />
          </Tooltip>
        }
      />

      <div
        style={{
          padding: '24px 40px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* 顶部控制栏 */}
        <div
          style={{
            marginBottom: 24,
            padding: '16px 24px',
            background: '#f5f7fa',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 16 }}>
              启用外部 API 服务
            </Text>
            <Text type="secondary">开启后允许通过 RESTful API 进行数据交互</Text>
          </Space>
          <Switch checked={enabled} onChange={handleToggleStatus} loading={loading} />
        </div>

        {/* 内容区域 */}
        {enabled ? (
          <Card
            title="令牌管理"
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsModalVisible(true)}
              >
                新建令牌
              </Button>
            }
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
            styles={{
              body: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: 0 },
            }}
          >
            <TokenTable
              tokens={tokens}
              loading={loading}
              onShowCode={showCodeDrawer}
              onDelete={handleDeleteToken}
              onEdit={handleEditToken}
              onCopyToken={copyToClipboard}
            />
          </Card>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Result
              icon={<ApiOutlined style={{ color: '#d9d9d9' }} />}
              title="尚未启用外部 API"
              subTitle="启用服务后,您可以创建安全令牌 (Token) 以供第三方系统集成。"
              extra={
                <Button type="primary" onClick={() => handleToggleStatus(true)}>
                  立即启用
                </Button>
              }
            />
          </div>
        )}
      </div>

      <CreateTokenModal
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onSubmit={handleAddToken}
        submitting={submitting}
      />

      <EditTokenModal
        visible={isEditModalVisible}
        token={editingToken}
        onCancel={() => {
          setIsEditModalVisible(false);
          setEditingToken(null);
        }}
        onSubmit={handleUpdateToken}
        submitting={submitting}
      />

      <ResizableDrawer
        title="接入代码示例"
        extra={
          <Button
            icon={<CopyOutlined />}
            onClick={() => copyToClipboard(markdownContent, '配置文档已复制')}
          >
            复制全文
          </Button>
        }
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        defaultWidth={800}
        styles={{ body: { padding: '24px 32px' } }}
      >
        <XMarkdownDisplay>{markdownContent}</XMarkdownDisplay>
      </ResizableDrawer>
    </div>
  );
};

export default ExternalApiIntegration;
