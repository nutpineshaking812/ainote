import React, { useState, useEffect } from 'react';
import { Button, Table, Modal, Input, message, Alert, Typography, Row, Col } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getApiKeys, createApiKey, revokeApiKey } from '../../api/openApi';
import XMarkdownDisplay from '../../components/common/XMarkdownDisplay';
// Wait, MarkdownEditor is likely an editor. I should check if it has a read-only mode or use a different component.
// The user said "API Documentation部分使用markdown".
// Let's assume standard React Markdown or Ant Design's Paragraph for code blocks is still best for simple things,
// but if they specifically asked for Markdown to be used for the docs description, I should probably render some markdown.
// Actually, for the curl command, a code block is best.
// I'll stick to Paragraph code block for the command as it supports copy, which is "支持粘贴功能" (copy to clipboard).
// But since they asked for Markdown, I will wrap the content in a Markdown-like presentation if possible,
// or just use a markdown string and a renderer.
// However, to ensure "Support Paste" (Copy) works well for the code, Ant Design's Paragraph copyable is native and robust.
// I will use a simple Markdown renderer for the *text* description if needed, or just standard HTML/Components.
// Given the prompt "使用markdown", I will format the big text block as markdown and verify if I have a renderer.
// I'll check `RichMarkdownEditor` or `MarkdownEditor` if they export a viewer.
// Let's play it safe and use a robust implementation for the code snippet which is the core value here.
// I'll use the existing Ant Design Paragraph for the code snippet because it handles "Copy" perfectly.
// For the "Documentation" part, I will create a markdown string and render it.

const { Paragraph, Text } = Typography;

const DeveloperPage = () => {
  const { t } = useTranslation();
  const { appId } = useParams();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const data = await getApiKeys(appId);
      setKeys(data || []);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      message.error(t('common.operationFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [appId]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      message.error(t('appSettings.enterKeyName'));
      return;
    }
    try {
      const data = await createApiKey(appId, newKeyName);
      const newKey = data.key;

      setModalVisible(false);
      setNewKeyName('');
      fetchKeys();
      Modal.success({
        title: t('appSettings.generateSuccessTitle'),
        content: (
          <div>
            <p>{t('appSettings.generateSuccessContent')}</p>
            <Paragraph copyable code style={{ fontSize: '16px' }}>
              {newKey}
            </Paragraph>
          </div>
        ),
      });
    } catch (error) {
      message.error(t('common.operationFailed'));
    }
  };

  const handleDeleteKey = async (keyId) => {
    Modal.confirm({
      title: t('appSettings.revokeConfirmTitle'),
      content: t('appSettings.revokeConfirmContent'),
      okText: t('appSettings.revoke'),
      okType: 'danger',
      onOk: async () => {
        try {
          await revokeApiKey(appId, keyId);
          message.success(t('appSettings.revokeSuccess'));
          fetchKeys();
        } catch (error) {
          message.error(t('appSettings.revokeFailed'));
        }
      },
    });
  };

  const columns = [
    {
      title: t('appSettings.keyName'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('appSettings.keyPrefix'),
      dataIndex: 'prefix',
      key: 'prefix',
      render: (text) => <Text code>app_sk_{text}...</Text>,
    },
    {
      title: t('appSettings.created'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => text && format(new Date(text), 'yyyy-MM-dd HH:mm'),
    },
    {
      title: t('appSettings.lastUsed'),
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      render: (text) => (text ? format(new Date(text), 'yyyy-MM-dd HH:mm') : '-'),
    },
    {
      title: t('appSettings.action'),
      key: 'action',
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteKey(record._id)}
        >
          {t('appSettings.revoke')}
        </Button>
      ),
    },
  ];

  /* eslint-disable-next-line */
  const markdownContent = `
### ${t('appSettings.exampleUsage')}

${t('appSettings.exampleUsageDesc')}

#### 1. ${t('formBuilder.submit')}

\`\`\`bash
curl -X POST "${window.location.origin}/api/v1/open/apps/${appId}/forms/<FORM_ID>/submit" \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{"field_abc": "value"}'
\`\`\`

#### 2. ${t('publicQuery.dataQuery')}

\`\`\`bash
curl -X GET "${window.location.origin}/api/v1/open/apps/${appId}/forms/<FORM_ID>/records" \\
  -H "Authorization: Bearer <YOUR_API_KEY>"
\`\`\`

---

### 数字员工 API

#### 3. 获取数字员工列表

\`\`\`bash
curl -X GET "${window.location.origin}/api/v1/open/apps/${appId}/employees" \\
  -H "Authorization: Bearer <YOUR_API_KEY>"
\`\`\`

#### 4. 数字员工流式对话 (SSE)

\`\`\`bash
curl -X POST "${window.location.origin}/api/v1/open/apps/${appId}/employees/chat" \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -H "Accept: text/event-stream" \\
  -d '{"employeeId": "<EMPLOYEE_ID>", "content": "你好，请帮我..."}'
\`\`\`

#### 5. 内嵌 UI 集成（iframe 方式）

直接将数字员工聊天界面嵌入到您的平台：

\`\`\`html
<iframe
  src="${window.location.origin}/embed/employee?appId=${appId}&apiKey=<YOUR_API_KEY>"
  width="100%"
  height="600px"
  style="border: none; border-radius: 8px;"
></iframe>
\`\`\`

可选参数：
- \`themeColor=#6366f1\` — 自定义主题色
- \`title=AI 助手\` — 自定义标题
`;

  return (
    <div style={{ padding: '24px', overflow: 'auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '24px',
          alignItems: 'center',
        }}
      >
        <p style={{ margin: 0, color: '#666' }}>{t('appSettings.manageApiKeys')}</p>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          {t('appSettings.createKey')}
        </Button>
      </div>

      <Table
        dataSource={keys}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={false}
      />

      <div style={{ marginTop: '48px' }}>
        <h3>{t('appSettings.apiDocs')}</h3>
        <div style={{ border: '1px solid #f0f0f0', padding: '16px', borderRadius: '8px' }}>
          <XMarkdownDisplay>{markdownContent}</XMarkdownDisplay>
        </div>
      </div>

      <Modal
        title={t('appSettings.createKey')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleCreateKey}
      >
        <div style={{ marginBottom: '8px' }}>{t('appSettings.keyName')}</div>
        <Input
          placeholder={t('appSettings.keyNamePlaceholder')}
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default DeveloperPage;
