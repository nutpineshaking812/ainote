import React, { useEffect, useState, useMemo } from 'react';
import { ConfigProvider, App, Spin, Alert, Button, Typography, theme } from 'antd';
import { LoadingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { AgentDockProvider } from '../../features/chat/context/AgentDockContext';
import { AgentDock } from '../../features/chat/components/AgentDock';
import { AgentWorkspace } from '../../features/chat/components/AgentWorkspace';
import { EMPLOYEE_SCENARIOS } from '../../constants/employee';
import { API_URL } from '../../api';

const { Title, Text } = Typography;

/**
 * 内嵌式数字员工页面
 *
 * 外部平台通过 URL 参数传入 appId 和 apiKey 即可直接接入数字员工对话能力。
 * 无需用户登录，完全基于应用密钥（API Key）进行鉴权。
 *
 * 使用方式：
 *   /embed/employee?appId=<APPLICATION_ID>&apiKey=<API_KEY>
 *
 * 可选参数：
 *   themeColor=#6366f1  主题色
 *   title=AI 助手       自定义标题
 */
export default function EmbeddedEmployeePage() {
  const [searchParams] = useSearchParams();
  const appId = searchParams.get('appId');
  const apiKey = searchParams.get('apiKey');
  const themeColor = searchParams.get('themeColor') || '#6366f1';
  const customTitle = searchParams.get('title');

  const [authState, setAuthState] = useState({
    loading: true,
    error: null,
    userId: null,
  });

  // 鉴权：用 API Key 换取 JWT Session
  useEffect(() => {
    if (!appId || !apiKey) {
      setAuthState({ loading: false, error: '缺少必要参数：appId 或 apiKey', userId: null });
      return;
    }

    let cancelled = false;

    const initSession = async () => {
      try {
        // 调用 Session 端点，用 API Key 换取 JWT
        const res = await fetch(`${API_URL}/open/apps/${appId}/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({}),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || json.error || 'Session 创建失败');
        }

        const { token, userId: sessionUserId } = json.data;

        // 将 JWT 存入 localStorage，后续所有 API/SSE 请求自动携带
        localStorage.setItem('token', token);

        if (!cancelled) {
          setAuthState({ loading: false, error: null, userId: sessionUserId });
        }
      } catch (err) {
        console.error('[EmbeddedEmployee] Session init error:', err);
        if (!cancelled) {
          setAuthState({
            loading: false,
            error: err.message || '鉴权失败，请检查 API Key 是否有效',
            userId: null,
          });
        }
      }
    };

    initSession();

    return () => {
      cancelled = true;
    };
  }, [appId, apiKey]);

  // 自定义主题
  const customTheme = useMemo(() => {
    const baseToken = theme.defaultConfig;
    return {
      token: {
        colorPrimary: themeColor,
        colorPrimaryHover: themeColor,
        colorPrimaryActive: themeColor,
        colorPrimaryBg: `${themeColor}15`,
      },
    };
  }, [themeColor]);

  // 鉴权中
  if (authState.loading) {
    return (
      <ConfigProvider theme={customTheme}>
        <App>
          <div
            style={{
              width: '100vw',
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f7f8fc',
              gap: 16,
            }}
          >
            <Spin indicator={<LoadingOutlined style={{ fontSize: 36 }} spin />} />
            <Text type="secondary">正在连接数字员工服务...</Text>
          </div>
        </App>
      </ConfigProvider>
    );
  }

  // 鉴权失败
  if (authState.error || !appId) {
    return (
      <ConfigProvider theme={customTheme}>
        <App>
          <div
            style={{
              width: '100vw',
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f7f8fc',
              padding: 24,
            }}
          >
            <Alert
              type="error"
              message="无法连接到数字员工"
              description={
                <div>
                  <p>{authState.error || '缺少必要参数'}</p>
                  <p style={{ marginBottom: 0 }}>
                    <Text code style={{ fontSize: 12 }}>
                      /embed/employee?appId=&lt;APP_ID&gt;&amp;apiKey=&lt;API_KEY&gt;
                    </Text>
                  </p>
                </div>
              }
              style={{ maxWidth: 520 }}
            />
            <Button
              type="primary"
              style={{ marginTop: 16 }}
              onClick={() => window.location.reload()}
            >
              重试
            </Button>
          </div>
        </App>
      </ConfigProvider>
    );
  }

  // 鉴权成功，渲染数字员工聊天界面
  return (
    <ConfigProvider theme={customTheme}>
      <App>
        <AgentDockProvider
          appId={appId}
          targetId={appId}
          scenario={EMPLOYEE_SCENARIOS.GENERAL}
          externalUserId={authState.userId}
          apiMode="open"
        >
          <div
            style={{
              width: '100vw',
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              background: '#fff',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* 顶部标题栏 */}
            <div
              style={{
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: '1px solid #f0f0f0',
                background: '#fafbfc',
                flexShrink: 0,
                gap: 8,
              }}
            >
              <ThunderboltOutlined style={{ color: themeColor, fontSize: 16 }} />
              <Title level={5} style={{ margin: 0, fontWeight: 600, color: '#333' }}>
                {customTitle || 'AI 数字员工'}
              </Title>
            </div>

            {/* 聊天主区域 */}
            <div
              style={{
                flex: 1,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <AgentWorkspace
                appId={appId}
                defaultDisplayMode="panel"
                modes={['panel']}
                showMinimizeAction={false}
              />

              {/* 悬浮 Agent Dock（参考 DocumentResourcePanel 的集成方式） */}
              <AgentDock placement="right" />
            </div>
          </div>
        </AgentDockProvider>
      </App>
    </ConfigProvider>
  );
}
