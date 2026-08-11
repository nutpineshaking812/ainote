import React, { useState, useCallback } from 'react';
import {
  ConfigProvider, App, Tabs, Card, Input, Button, Space, Typography,
  Divider, Tag, message, Alert, Descriptions, Tooltip, Collapse,
} from 'antd';
import {
  CodeOutlined, LinkOutlined, ApiOutlined, CopyOutlined,
  ThunderboltOutlined, CheckCircleOutlined, GlobalOutlined,
  RocketOutlined, PlayCircleOutlined, EyeOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import XMarkdownDisplay from '../../components/common/XMarkdownDisplay';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const THEME = {
  primary: '#6366f1',
  primaryBg: '#eef2ff',
  border: '#e5e7eb',
  bg: '#f8fafc',
  cardBg: '#ffffff',
  radius: 12,
};

// ---- 配置区域 ----
const parseSearchParams = () => {
  const sp = new URLSearchParams(window.location.search);
  return {
    appId: sp.get('appId') || '',
    apiKey: sp.get('apiKey') || '',
  };
};

// ---- 代码片段 ----
const buildBaseUrl = () => window.location.origin;

const codeSnippets = {
  iframe: (appId, apiKey) => `
<!-- 一行代码嵌入数字员工 AI 助手 -->
<iframe
  src="${buildBaseUrl()}/embed/employee?appId=${appId}&apiKey=${apiKey}"
  width="400px"
  height="600px"
  style="border: none; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);"
></iframe>

<!-- 可选参数 -->
<!-- themeColor=%236366f1  自定义主题色 -->
<!-- title=AI%20助手      自定义标题 -->
`.trim(),

  employees: (appId, apiKey) => `
// 获取数字员工列表
const employees = await fetch(
  "${buildBaseUrl()}/api/v1/open/apps/${appId}/employees",
  { headers: { Authorization: "Bearer ${apiKey}" } }
).then(r => r.json());

// employees.data = [
//   { id: "...", name: "文档助手", roleTitle: "AI 写作助手", ... },
//   { id: "...", name: "数据分析师", ... }
// ]
`.trim(),

  chat: (appId, apiKey) => `
// SSE 流式对话 — 前端 JavaScript 示例
async function chat(employeeId, content) {
  const res = await fetch(
    "${buildBaseUrl()}/api/v1/open/apps/${appId}/employees/chat",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer ${apiKey}",
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ employeeId, content }),
    }
  );

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (const line of buffer.split("\\n")) {
      if (line.startsWith("data: ")) {
        const { event, answer } = JSON.parse(line.slice(6));
        if (event === "message") console.log(answer); // 增量文本
        if (event === "done")     console.log("完成");
        if (event === "error")    console.error(answer);
      }
    }
  }
}

chat("emp_001", "帮我写周报");
`.trim(),

  curlEmployees: (appId, apiKey) => `
curl -s "${buildBaseUrl()}/api/v1/open/apps/${appId}/employees" \\
  -H "Authorization: Bearer ${apiKey}" | python3 -m json.tool
`.trim(),

  curlChat: (appId, apiKey) => `
curl -N -X POST "${buildBaseUrl()}/api/v1/open/apps/${appId}/employees/chat" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -H "Accept: text/event-stream" \\
  -d '{"employeeId":"<EMPLOYEE_ID>","content":"你好"}'
`.trim(),

  session: (appId, apiKey) => `
// 获取临时 JWT Session Token（24h 有效，更安全的方案）
const { token } = await fetch(
  "${buildBaseUrl()}/api/v1/open/apps/${appId}/session",
  {
    method: "POST",
    headers: { Authorization: "Bearer ${apiKey}" },
  }
).then(r => r.json()).then(d => d.data);

// 之后可以用 token 代替 apiKey 发起请求
localStorage.setItem("token", token);
`.trim(),
};

// ---- 复制到剪贴板 ----
const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  } catch {
    message.error('复制失败');
  }
};

// ---- 配置面板 ----
function ConfigPanel({ appId: initAppId, apiKey: initApiKey, onChange }) {
  const [appId, setAppId] = useState(initAppId);
  const [apiKey, setApiKey] = useState(initApiKey);

  const handleApply = () => {
    onChange({ appId: appId.trim(), apiKey: apiKey.trim() });
  };

  return (
    <Card
      size="small"
      style={{ marginBottom: 20, background: THEME.bg, borderRadius: THEME.radius }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThunderboltOutlined style={{ color: THEME.primary }} />
          <Text strong>API 连接配置</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            （在开发者页面生成密钥后填入下方）
          </Text>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Input
            placeholder="应用 ID (appId)"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            style={{ flex: '1 1 240px' }}
            prefix={<GlobalOutlined style={{ color: '#94a3b8' }} />}
            allowClear
          />
          <Input.Password
            placeholder="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{ flex: '1 1 320px' }}
            prefix={<CodeOutlined style={{ color: '#94a3b8' }} />}
            allowClear
          />
          <Button type="primary" onClick={handleApply} icon={<PlayCircleOutlined />}>
            应用配置
          </Button>
        </div>
      </Space>
    </Card>
  );
}

// ---- iframe 嵌入 Tab ----
function IframeTab({ appId, apiKey }) {
  const [showPreview, setShowPreview] = useState(false);
  const hasConfig = appId && apiKey;

  return (
    <div>
      <Card
        style={{ borderRadius: THEME.radius, marginBottom: 20 }}
        bodyStyle={{ padding: '24px 24px 20px' }}
      >
        <Title level={4} style={{ marginTop: 0 }}>
          <LinkOutlined style={{ marginRight: 8 }} />
          iframe 嵌入方案
        </Title>
        <Paragraph type="secondary">
          只需一行 HTML 代码，将完整的数字员工聊天界面嵌入到任何网页。无需开发，开箱即用。
        </Paragraph>

        {!hasConfig && (
          <Alert
            type="info"
            message="请先在上方配置区域填入 appId 和 apiKey"
            style={{ marginBottom: 16 }}
            showIcon
          />
        )}

        <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
          <Descriptions.Item label="认证方式">API Key → JWT Session</Descriptions.Item>
          <Descriptions.Item label="依赖">零依赖，纯 HTML</Descriptions.Item>
          <Descriptions.Item label="自定义主题">
            <Tag color="purple">themeColor</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="自定义标题">
            <Tag color="blue">title</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="响应式布局">支持任意宽高</Descriptions.Item>
          <Descriptions.Item label="多实例">单页可嵌入多个</Descriptions.Item>
        </Descriptions>

        {hasConfig && (
          <>
            <div style={{ marginBottom: 12 }}>
              <Button
                icon={showPreview ? <EyeOutlined /> : <RocketOutlined />}
                onClick={() => setShowPreview(!showPreview)}
                type={showPreview ? 'default' : 'primary'}
              >
                {showPreview ? '关闭预览' : '预览效果'}
              </Button>
            </div>

            {showPreview && (
              <div
                style={{
                  border: `2px solid ${THEME.primary}40`,
                  borderRadius: THEME.radius,
                  overflow: 'hidden',
                  marginBottom: 16,
                  background: '#fff',
                }}
              >
                <div
                  style={{
                    height: 460,
                    width: '100%',
                    display: 'flex',
                  }}
                >
                  <iframe
                    src={`/embed/employee?appId=${appId}&apiKey=${apiKey}&themeColor=%236366f1&title=AI%20助手`}
                    style={{
                      flex: 1,
                      border: 'none',
                    }}
                    title="数字员工预览"
                  />
                  {/* 拖拽调整宽度手柄 */}
                  <div
                    style={{
                      width: 4,
                      cursor: 'col-resize',
                      background: THEME.primary + '30',
                      flexShrink: 0,
                    }}
                  />
                  {/* 代码面板 */}
                  <div
                    style={{
                      width: 360,
                      flexShrink: 0,
                      borderLeft: `1px solid ${THEME.border}`,
                      background: '#1e293b',
                      overflow: 'auto',
                      position: 'relative',
                    }}
                  >
                    <Tooltip title="复制代码">
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined style={{ color: '#94a3b8' }} />}
                        onClick={() => copyText(codeSnippets.iframe(appId, apiKey))}
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          zIndex: 1,
                        }}
                      />
                    </Tooltip>
                    <pre
                      style={{
                        color: '#e2e8f0',
                        padding: '24px 16px',
                        margin: 0,
                        fontSize: 13,
                        lineHeight: 1.7,
                        fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      <code>{codeSnippets.iframe(appId, apiKey)}</code>
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <Collapse
          size="small"
          items={[
            {
              key: 'code',
              label: (
                <Space>
                  <CodeOutlined />
                  查看代码
                </Space>
              ),
              children: hasConfig ? (
                <div style={{ position: 'relative' }}>
                  <Tooltip title="复制代码">
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyText(codeSnippets.iframe(appId, apiKey))}
                      style={{ position: 'absolute', top: 0, right: 0 }}
                    />
                  </Tooltip>
                  <pre
                    style={{
                      background: '#1e293b',
                      color: '#e2e8f0',
                      padding: 20,
                      borderRadius: 8,
                      overflow: 'auto',
                      fontSize: 13,
                      lineHeight: 1.7,
                      margin: 0,
                    }}
                  >
                    <code>{codeSnippets.iframe(appId, apiKey)}</code>
                  </pre>
                </div>
              ) : (
                <Paragraph type="secondary">
                  请先填入 appId 和 apiKey 以生成代码
                </Paragraph>
              ),
            },
          ]}
        />
      </Card>

      {/* 使用场景 */}
      <Card
        title={<><CheckCircleOutlined style={{ color: '#22c55e', marginRight: 8 }} />适用场景</>}
        style={{ borderRadius: THEME.radius }}
        bodyStyle={{ padding: 24 }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {[
            { title: '内部管理后台', desc: '在 CRM、ERP 等系统中嵌入 AI 助手' },
            { title: '官网 / 帮助中心', desc: '用户无需登录即可使用 AI 客服' },
            { title: 'SaaS 产品', desc: '为客户平台快速添加 AI 能力' },
            { title: 'Notion / 飞书文档', desc: '通过嵌入网页模块集成 AI 协同' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <Tag color="blue" style={{ flexShrink: 0, marginTop: 2 }}>{i + 1}</Tag>
              <div>
                <Text strong>{item.title}</Text>
                <br />
                <Text type="secondary">{item.desc}</Text>
              </div>
            </div>
          ))}
        </Space>
      </Card>
    </div>
  );
}

// ---- API 集成 Tab ----
function ApiTab({ appId, apiKey }) {
  const hasConfig = appId && apiKey;

  return (
    <div>
      <Card
        style={{ borderRadius: THEME.radius, marginBottom: 20 }}
        bodyStyle={{ padding: '24px 24px 20px' }}
      >
        <Title level={4} style={{ marginTop: 0 }}>
          <ApiOutlined style={{ marginRight: 8 }} />
          API 集成方案
        </Title>
        <Paragraph type="secondary">
          通过 RESTful API + SSE 流式协议，在你的服务端或前端直接调用数字员工能力，自定义 UI 展示。
        </Paragraph>

        {!hasConfig && (
          <Alert
            type="info"
            message="请先在上方配置区域填入 appId 和 apiKey"
            style={{ marginBottom: 16 }}
            showIcon
          />
        )}
      </Card>

      {/* 流程概览 */}
      <Card
        style={{ borderRadius: THEME.radius, marginBottom: 20, background: THEME.primaryBg }}
        bodyStyle={{ padding: 24 }}
      >
        <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 16 }}>
          集成流程
        </Text>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            flexWrap: 'wrap',
          }}
        >
          {[
            { icon: <CodeOutlined />, label: '创建 API Key' },
            { icon: <ApiOutlined />, label: '获取员工列表' },
            { icon: <ThunderboltOutlined />, label: 'SSE 流式对话' },
            { icon: <CheckCircleOutlined />, label: '自定义 UI 渲染' },
          ].map((step, i) => (
            <React.Fragment key={i}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: '#fff',
                  borderRadius: THEME.radius,
                  border: `1px solid ${THEME.border}`,
                  minWidth: 120,
                }}
              >
                <div style={{ fontSize: 22, color: THEME.primary, marginBottom: 8 }}>
                  {step.icon}
                </div>
                <Tag color="purple">{i + 1}</Tag>
                <Text style={{ fontSize: 12, marginTop: 4 }}>{step.label}</Text>
              </div>
              {i < 3 && (
                <div
                  style={{
                    width: 32, height: 2, background: THEME.primary + '40',
                    flexShrink: 0, margin: '0 -4px',
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </Card>

      {/* 步骤 1: 获取员工列表 */}
      <Card
        style={{ borderRadius: THEME.radius, marginBottom: 16 }}
        title={
          <Space>
            <Tag>步骤 1</Tag>
            <Text strong>获取数字员工列表</Text>
          </Space>
        }
        bodyStyle={{ padding: 24 }}
      >
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          获取应用下所有可用的数字员工，包含名称、头像、快捷工具等元信息。
        </Paragraph>
        {hasConfig ? (
          <Collapse
            size="small"
            items={[
              {
                key: 'js',
                label: 'JavaScript',
                children: (
                  <div style={{ position: 'relative' }}>
                    <Tooltip title="复制代码">
                      <Button
                        type="text" size="small" icon={<CopyOutlined />}
                        onClick={() => copyText(codeSnippets.employees(appId, apiKey))}
                        style={{ position: 'absolute', top: 0, right: 0 }}
                      />
                    </Tooltip>
                    <pre
                      style={{
                        background: '#1e293b', color: '#e2e8f0', padding: 20,
                        borderRadius: 8, overflow: 'auto', fontSize: 13,
                        lineHeight: 1.7, margin: 0,
                      }}
                    >
                      <code>{codeSnippets.employees(appId, apiKey)}</code>
                    </pre>
                  </div>
                ),
              },
              {
                key: 'curl',
                label: 'cURL',
                children: (
                  <div style={{ position: 'relative' }}>
                    <Tooltip title="复制代码">
                      <Button
                        type="text" size="small" icon={<CopyOutlined />}
                        onClick={() => copyText(codeSnippets.curlEmployees(appId, apiKey))}
                        style={{ position: 'absolute', top: 0, right: 0 }}
                      />
                    </Tooltip>
                    <pre
                      style={{
                        background: '#1e293b', color: '#e2e8f0', padding: 20,
                        borderRadius: 8, overflow: 'auto', fontSize: 13,
                        lineHeight: 1.7, margin: 0,
                      }}
                    >
                      <code>{codeSnippets.curlEmployees(appId, apiKey)}</code>
                    </pre>
                  </div>
                ),
              },
            ]}
          />
        ) : (
          <Paragraph type="secondary">请先填入 appId 和 apiKey</Paragraph>
        )}
      </Card>

      {/* 步骤 2: 流式对话 */}
      <Card
        style={{ borderRadius: THEME.radius, marginBottom: 16 }}
        title={
          <Space>
            <Tag>步骤 2</Tag>
            <Text strong>SSE 流式对话</Text>
          </Space>
        }
        bodyStyle={{ padding: 24 }}
      >
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          通过 Server-Sent Events 协议，实现打字机效果的实时流式输出，体验类似 ChatGPT 的逐字展示。
        </Paragraph>
        {hasConfig ? (
          <Collapse
            size="small"
            items={[
              {
                key: 'js',
                label: 'JavaScript',
                children: (
                  <div style={{ position: 'relative' }}>
                    <Tooltip title="复制代码">
                      <Button
                        type="text" size="small" icon={<CopyOutlined />}
                        onClick={() => copyText(codeSnippets.chat(appId, apiKey))}
                        style={{ position: 'absolute', top: 0, right: 0 }}
                      />
                    </Tooltip>
                    <pre
                      style={{
                        background: '#1e293b', color: '#e2e8f0', padding: 20,
                        borderRadius: 8, overflow: 'auto', fontSize: 13,
                        lineHeight: 1.7, margin: 0,
                      }}
                    >
                      <code>{codeSnippets.chat(appId, apiKey)}</code>
                    </pre>
                  </div>
                ),
              },
              {
                key: 'curl',
                label: 'cURL',
                children: (
                  <div style={{ position: 'relative' }}>
                    <Tooltip title="复制代码">
                      <Button
                        type="text" size="small" icon={<CopyOutlined />}
                        onClick={() => copyText(codeSnippets.curlChat(appId, apiKey))}
                        style={{ position: 'absolute', top: 0, right: 0 }}
                      />
                    </Tooltip>
                    <pre
                      style={{
                        background: '#1e293b', color: '#e2e8f0', padding: 20,
                        borderRadius: 8, overflow: 'auto', fontSize: 13,
                        lineHeight: 1.7, margin: 0,
                      }}
                    >
                      <code>{codeSnippets.curlChat(appId, apiKey)}</code>
                    </pre>
                  </div>
                ),
              },
            ]}
          />
        ) : (
          <Paragraph type="secondary">请先填入 appId 和 apiKey</Paragraph>
        )}
      </Card>

      {/* 步骤 3: Session Token */}
      <Card
        style={{ borderRadius: THEME.radius, marginBottom: 16 }}
        title={
          <Space>
            <Tag>步骤 3</Tag>
            <Text strong>获取 Session Token（推荐）</Text>
          </Space>
        }
        bodyStyle={{ padding: 24 }}
      >
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          为避免将 API Key 暴露在前端代码中，推荐先通过服务端用 API Key 换取一个短期 JWT Token（24h 有效），
          后续请求使用 Token 替代 API Key。
        </Paragraph>
        {hasConfig ? (
          <div style={{ position: 'relative' }}>
            <Tooltip title="复制代码">
              <Button
                type="text" size="small" icon={<CopyOutlined />}
                onClick={() => copyText(codeSnippets.session(appId, apiKey))}
                style={{ position: 'absolute', top: 0, right: 0 }}
              />
            </Tooltip>
            <pre
              style={{
                background: '#1e293b', color: '#e2e8f0', padding: 20,
                borderRadius: 8, overflow: 'auto', fontSize: 13,
                lineHeight: 1.7, margin: 0,
              }}
            >
              <code>{codeSnippets.session(appId, apiKey)}</code>
            </pre>
          </div>
        ) : (
          <Paragraph type="secondary">请先填入 appId 和 apiKey</Paragraph>
        )}
      </Card>

      {/* API 参考表 */}
      <Card
        title="API 端点参考"
        style={{ borderRadius: THEME.radius }}
        bodyStyle={{ padding: 24 }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ background: THEME.bg }}>
                {['方法', '端点', '认证', '说明'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', borderBottom: `2px solid ${THEME.border}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['POST', '/api/v1/open/apps/:appId/session', 'API Key', '用 API Key 换取 JWT Token'],
                ['GET', '/api/v1/open/apps/:appId/employees', 'API Key / JWT', '获取数字员工列表'],
                ['POST', '/api/v1/open/apps/:appId/employees/chat', 'API Key / JWT', 'SSE 流式对话'],
                ['POST', '/api/v1/open/apps/:appId/forms/:formId/submit', 'API Key / JWT', '表单数据提交'],
                ['GET', '/api/v1/open/apps/:appId/forms/:formId/records', 'API Key / JWT', '表单数据查询'],
              ].map(([method, endpoint, auth, desc], i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                  <td style={{ padding: '10px 16px' }}>
                    <Tag
                      color={
                        method === 'GET' ? 'green' :
                        method === 'POST' ? 'blue' :
                        'default'
                      }
                      style={{ fontFamily: 'monospace' }}
                    >
                      {method}
                    </Tag>
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12 }}>
                    <Text code>{endpoint}</Text>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <Text type="secondary">{auth}</Text>
                  </td>
                  <td style={{ padding: '10px 16px' }}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---- SSR / 服务端集成 Tab ----
function ServerTab({ appId, apiKey }) {
  const hasConfig = appId && apiKey;

  const nodeCode = hasConfig ? `
// Node.js 服务端集成示例
const BASE = "${buildBaseUrl()}/api/v1/open/apps/${appId}";

// 获取员工列表
async function getEmployees() {
  const res = await fetch(\`\${BASE}/employees\`, {
    headers: { Authorization: "Bearer ${apiKey}" },
  });
  return res.json();
}

// 流式对话（转发给前端）
async function proxyChat(req, res) {
  const { employeeId, content } = req.body;
  const upstream = await fetch(\`\${BASE}/employees/chat\`, {
    method: "POST",
    headers: {
      Authorization: "Bearer ${apiKey}",
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ employeeId, content }),
  });

  // 直接转发 SSE 流到客户端
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  upstream.body.pipe(res);
}
`.trim() : '请先填入 appId 和 apiKey';

  return (
    <div>
      <Card style={{ borderRadius: THEME.radius, marginBottom: 20 }}>
        <Title level={4} style={{ marginTop: 0 }}>
          <RocketOutlined style={{ marginRight: 8 }} />
          服务端集成方案
        </Title>
        <Paragraph type="secondary">
          在你的后端服务中代理 API 调用，避免 API Key 暴露在前端，同时可以加入更多业务逻辑。
        </Paragraph>

        {!hasConfig && (
          <Alert
            type="info"
            message="请先在上方配置区域填入 appId 和 apiKey"
            style={{ marginBottom: 16 }}
            showIcon
          />
        )}
      </Card>

      <Card
        title="Node.js 示例"
        style={{ borderRadius: THEME.radius, marginBottom: 16 }}
        bodyStyle={{ padding: 24 }}
      >
        <Paragraph type="secondary">
          在后端封装 API 调用，前端只需与你自己的后端通信：
        </Paragraph>
        <div style={{ position: 'relative' }}>
          <Tooltip title="复制代码">
            <Button
              type="text" size="small" icon={<CopyOutlined />}
              onClick={() => copyText(nodeCode)}
              style={{ position: 'absolute', top: 0, right: 0 }}
            />
          </Tooltip>
          <pre
            style={{
              background: '#1e293b', color: '#e2e8f0', padding: 20,
              borderRadius: 8, overflow: 'auto', fontSize: 13,
              lineHeight: 1.7, margin: 0,
            }}
          >
            <code>{nodeCode}</code>
          </pre>
        </div>
      </Card>

      <Card
        title="架构对比"
        style={{ borderRadius: THEME.radius }}
        bodyStyle={{ padding: 24 }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {[
            {
              title: '方案 A：纯前端',
              desc: '直接在浏览器中调用 API Key',
              pros: ['最简单', '零服务端代码', '适合内部工具'],
              cons: ['API Key 暴露', '无访问控制'],
              color: 'orange',
            },
            {
              title: '方案 B：后端代理',
              desc: '服务端封装 API 调用',
              pros: ['API Key 安全', '可加限流/计费', '可做权限控制'],
              cons: ['需要后端开发'],
              color: 'green',
            },
            {
              title: '方案 C：iframe 嵌入',
              desc: '一行 HTML 完成集成',
              pros: ['零开发', '自动升级', 'UI 一致'],
              cons: ['样式定制有限'],
              color: 'blue',
            },
          ].map((item, i) => (
            <Card
              key={i}
              size="small"
              style={{ borderTop: `3px solid ${item.color}` }}
              title={<Text strong>{item.title}</Text>}
            >
              <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                {item.desc}
              </Paragraph>
              <div style={{ marginBottom: 8 }}>
                <Text type="success" strong style={{ fontSize: 12 }}>✅ 优点</Text>
                <ul style={{ paddingLeft: 18, margin: '4px 0 0', fontSize: 13 }}>
                  {item.pros.map((p, j) => <li key={j}>{p}</li>)}
                </ul>
              </div>
              <div>
                <Text type="danger" strong style={{ fontSize: 12 }}>⚠️ 注意</Text>
                <ul style={{ paddingLeft: 18, margin: '4px 0 0', fontSize: 13 }}>
                  {item.cons.map((c, j) => <li key={j}>{c}</li>)}
                </ul>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---- 主页面 ----
export default function IntegrationDemoPage() {
  const initParams = parseSearchParams();
  const [config, setConfig] = useState({
    appId: initParams.appId,
    apiKey: initParams.apiKey,
  });

  const handleConfigChange = useCallback((newConfig) => {
    setConfig(newConfig);
    // 同步更新 URL，方便分享
    const url = new URL(window.location);
    if (newConfig.appId) url.searchParams.set('appId', newConfig.appId);
    else url.searchParams.delete('appId');
    if (newConfig.apiKey) url.searchParams.set('apiKey', newConfig.apiKey);
    else url.searchParams.delete('apiKey');
    window.history.replaceState({}, '', url.toString());
  }, []);

  const tabItems = [
    {
      key: 'iframe',
      label: (
        <span>
          <LinkOutlined /> iframe 嵌入
        </span>
      ),
      children: <IframeTab appId={config.appId} apiKey={config.apiKey} />,
    },
    {
      key: 'api',
      label: (
        <span>
          <ApiOutlined /> API 集成
        </span>
      ),
      children: <ApiTab appId={config.appId} apiKey={config.apiKey} />,
    },
    {
      key: 'server',
      label: (
        <span>
          <RocketOutlined /> 服务端集成
        </span>
      ),
      children: <ServerTab appId={config.appId} apiKey={config.apiKey} />,
    },
  ];

  return (
    <ConfigProvider>
      <App>
        <div
          style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f0f4ff 0%, #f8fafc 50%, #f0f4ff 100%)',
            padding: '24px 24px 48px',
          }}
        >
          {/* 页头 */}
          <div
            style={{
              maxWidth: 1100,
              margin: '0 auto 24px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 56,
                height: 56,
                borderRadius: 16,
                background: `linear-gradient(135deg, ${THEME.primary}, #818cf8)`,
                marginBottom: 16,
                boxShadow: `0 8px 24px ${THEME.primary}40`,
              }}
            >
              <ThunderboltOutlined style={{ fontSize: 26, color: '#fff' }} />
            </div>
            <Title level={2} style={{ marginBottom: 8 }}>
              数字员工 · 集成示例
            </Title>
            <Paragraph type="secondary" style={{ fontSize: 15, maxWidth: 600, margin: '0 auto' }}>
              展示如何将平台的 AI 数字员工能力外化到您的应用中。
              支持 iframe 嵌入、API 调用、服务端代理三种集成方式。
            </Paragraph>
          </div>

          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            {/* 配置面板 */}
            <ConfigPanel
              appId={config.appId}
              apiKey={config.apiKey}
              onChange={handleConfigChange}
            />

            {/* Tab 内容 */}
            <Card
              style={{ borderRadius: THEME.radius }}
              bodyStyle={{ padding: 24 }}
            >
              <Tabs
                defaultActiveKey="iframe"
                size="large"
                items={tabItems}
                tabBarStyle={{ marginBottom: 24 }}
              />
            </Card>

            {/* 底部 */}
            <Divider style={{ marginTop: 40 }} />
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                前往
                {' '}
                <a href="/apps" style={{ color: THEME.primary }}>
                  应用管理
                </a>
                {' '}→ 选择应用 → 开发者页面，获取您的 API Key
              </Text>
            </div>
          </div>
        </div>
      </App>
    </ConfigProvider>
  );
}
