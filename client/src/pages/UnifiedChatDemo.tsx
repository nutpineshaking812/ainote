import React, { useState, useEffect } from 'react';
import UnifiedChatList, {
  UnifiedMessage,
  ThoughtItem,
} from '../features/chat/components/UnifiedChatList';
import { Layout, Button, Divider, Space, Typography, Card } from 'antd';
import { ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons';

const { Header, Content } = Layout;
const { Title, Paragraph } = Typography;

const MOCK_MESSAGES: UnifiedMessage[] = [
  {
    id: '1',
    role: 'user',
    parts: [{ type: 'text', content: '帮我分析一下腾讯控股 (0700.HK) 的近期表现。' }],
  },
  {
    id: '2',
    role: 'assistant',
    status: 'success',
    parts: [
      {
        type: 'thoughts',
        items: [
          {
            key: 't1',
            title: '理解用户需求',
            status: 'success',
            description: '用户需要腾讯控股 (0700.HK) 的近期财务表现和市场情绪分析。',
          },
          {
            key: 't2',
            title: '搜索最新行情数据',
            status: 'success',
            description: '成功调取 Yahoo Finance API，获取 2024 年 Q1 财报数据。',
          },
          {
            key: 't3',
            title: '分析技术指标',
            status: 'success',
            description: 'RSI 处于 45 低位，MACD 全面转正，日 K 线呈现典型的杯柄形态。',
          },
          {
            key: 't4',
            title: '浏览最新社交媒体情绪',
            status: 'success',
            description: '成功分析雪球及东方财富 1,200 条近期讨论，整体看多情绪占比 65%。',
          },
        ],
      },
      {
        type: 'text',
        content:
          '腾讯控股 (0700.HK) 近期表现稳健：\n\n1. **基本面**：Q1 净利润增长超预期，广告业务表现极为亮眼。\n2. **技术面**：目前正处于关键阻力位上方，成交量稳步放大。\n3. **市场情绪**：大行纷纷上调目标价至 480 港元上方。\n\n建议您可以关注后续周报数据的公布。',
      },
    ],
  },
  {
    id: '3',
    role: 'user',
    parts: [{ type: 'text', content: '它最近执行过什么重要的回购吗？' }],
  },
  {
    id: '4',
    role: 'assistant',
    status: 'loading',
    parts: [
      {
        type: 'thoughts',
        items: [
          {
            key: 't5',
            title: '搜索港交所公告',
            status: 'success',
            description: '成功获取港交所披露易 (HKEXnews) 最近 30 天的股份购回报告。',
          },
          {
            key: 't6',
            title: '汇总回购数据',
            status: 'success',
            description: '腾讯在 3 月份累计回购约 15 亿港元，回购价格区间在 320-350 港元。',
          },
          {
            key: 't7',
            title: '执行数据聚合工具',
            status: 'loading',
            description: '正在对过去三个月的回购频率与股价走势进行相关性分析...',
          },
        ],
      },
      {
        type: 'text',
        content: '正在为您整理腾讯近期的重要回购记录，请稍候...',
      },
    ],
  },
];

const UnifiedChatDemo: React.FC = () => {
  const [messages, setMessages] = useState<UnifiedMessage[]>(MOCK_MESSAGES);
  const [streaming, setStreaming] = useState(false);

  // 更加真实的详细流式模拟
  const startDetailedStream = () => {
    if (streaming) return;
    setStreaming(true);

    // 1. 先清空最后一条消息，准备重新开始流式模拟
    const initialStreamingMsg: UnifiedMessage = {
      id: 'streaming-demo',
      role: 'assistant' as const,
      status: 'loading',
      parts: [
        {
          type: 'thoughts',
          items: [{ key: 's1', title: '分析回购政策中...', status: 'loading' }],
          status: 'loading',
        },
      ],
    };

    setMessages((prev) => [...prev.filter((m) => m.id !== 'streaming-demo'), initialStreamingMsg]);

    let step = 0;
    const textPart1 = '根据港交所的数据，腾讯在过去一个月内表现出了极强的回购意愿。';
    const textPart2 =
      '具体到估值层面，这种持续回购在 330 港元附近形成了有效的底部支撑，建议关注后续的资金流入情况。';

    const interval = setInterval(() => {
      step++;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === 'streaming-demo') {
            const newParts = [...(m.parts || [])];
            let status = m.status;

            // --- 阶段 1: 第一波思考药丸 (3步) ---
            if (step <= 5 && newParts[0] && newParts[0].items) {
              const items = [...newParts[0].items];
              items[0] = {
                ...items[0],
                description: '查阅 2024 年度的最新回购规制变更...'.substring(0, step * 4),
              };
              newParts[0] = { ...newParts[0], items };
            }
            if (step === 6 && newParts[0] && newParts[0].items) {
              const items = [...newParts[0].items];
              items[0].status = 'success';
              if (!items.find((it) => it.key === 's1.2')) {
                items.push({
                  key: 's1.2',
                  title: '抓取港交所历史公告...',
                  status: 'loading',
                });
              }
              newParts[0] = { ...newParts[0], items };
            }
            if (step > 6 && step <= 10 && newParts[0] && newParts[0].items) {
              const items = [...newParts[0].items];
              if (items[1]) {
                items[1] = {
                  ...items[1],
                  description: '获取最近 30 天 25 笔回购记录并去重...'.substring(0, (step - 6) * 4),
                };
              }
              newParts[0] = { ...newParts[0], items };
            }
            if (step === 11 && newParts[0] && newParts[0].items) {
              const items = [...newParts[0].items];
              if (items[1]) items[1].status = 'success';
              if (!items.find((it) => it.key === 's1.3')) {
                items.push({ key: 's1.3', title: '汇总成交价格分布', status: 'loading' });
              }
              newParts[0] = { ...newParts[0], items };
            }
            if (step > 11 && step <= 15 && newParts[0] && newParts[0].items) {
              const items = [...newParts[0].items];
              if (items[2]) {
                items[2] = {
                  ...items[2],
                  description: '正在计算加权回购均价 (VWAP)...'.substring(0, (step - 11) * 4),
                };
              }
              newParts[0] = { ...newParts[0], items };
            }

            // --- 阶段 2: 第一波正文 ---
            if (step === 16 && newParts[0] && newParts[0].items) {
              const items = [...newParts[0].items];
              if (items[2]) items[2].status = 'success';
              newParts[0] = { ...newParts[0], items, status: 'success' };

              if (newParts.length === 1) {
                newParts.push({ type: 'text', content: '', status: 'loading' });
              }
            }
            if (step > 16 && step <= 30 && newParts[1]) {
              newParts[1] = { ...newParts[1], content: textPart1.substring(0, (step - 16) * 3) };
            }

            // --- 阶段 3: 第二波思考药丸 (2步) ---
            if (step === 31 && newParts[1]) {
              newParts[1] = { ...newParts[1], status: 'success' };
              if (newParts.length === 2) {
                newParts.push({
                  type: 'thoughts',
                  items: [{ key: 's2', title: '对比历史估值水平...', status: 'loading' }],
                  status: 'loading',
                });
              }
            }
            if (step > 31 && step <= 35 && newParts[2] && newParts[2].items) {
              const items = [...newParts[2].items];
              items[0] = {
                ...items[0],
                description: '提取过去 5 年 PE 与 PB 的分位值数据...'.substring(0, (step - 31) * 4),
              };
              newParts[2] = { ...newParts[2], items };
            }
            if (step === 36 && newParts[2] && newParts[2].items) {
              const items = [...newParts[2].items];
              items[0].status = 'success';
              if (!items.find((it) => it.key === 's2.2')) {
                items.push({
                  key: 's2.2',
                  title: '构建回购支撑力模型',
                  status: 'loading',
                });
              }
              newParts[2] = { ...newParts[2], items };
            }
            if (step > 36 && step <= 40 && newParts[2] && newParts[2].items) {
              const items = [...newParts[2].items];
              if (items[1]) {
                items[1] = {
                  ...items[1],
                  description: '通过 Logistic 回归评估底部支撑强度指标...'.substring(
                    0,
                    (step - 36) * 4,
                  ),
                };
              }
              newParts[2] = { ...newParts[2], items };
            }

            // --- 阶段 4: 第二波正文 ---
            if (step === 41 && newParts[2] && newParts[2].items) {
              const items = [...newParts[2].items];
              if (items[1]) items[1].status = 'success';
              newParts[2] = { ...newParts[2], items, status: 'success' };

              if (newParts.length === 3) {
                newParts.push({ type: 'text', content: '', status: 'loading' });
              }
            }
            if (step > 41 && step <= 65 && newParts[3]) {
              newParts[3] = { ...newParts[3], content: textPart2.substring(0, (step - 41) * 3) };
            }

            // 结束
            if (step > 70) {
              if (newParts[3]) newParts[3].status = 'success';
              status = 'success';
              clearInterval(interval);
              setStreaming(false);
            }

            return { ...m, parts: newParts, status };
          }
          return m;
        }),
      );
    }, 80);
  };

  const reset = () => {
    setMessages(MOCK_MESSAGES);
    setStreaming(false);
  };

  return (
    <Layout style={{ height: '100vh', background: '#f5f5f5' }}>
      <Header style={{ background: '#fff', borderBottom: '1px solid #e8e8e8', padding: '0 24px' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }}>
            X-ChatMessageList 思维链演示 (TS)
          </Title>
          <Space>
            <Button
              icon={<PlayCircleOutlined />}
              type="primary"
              onClick={startDetailedStream}
              disabled={streaming}
            >
              开启详细流式模拟 (Streaming)
            </Button>
            <Button icon={<ReloadOutlined />} onClick={reset}>
              重置 mock
            </Button>
          </Space>
        </Space>
      </Header>
      <Content style={{ padding: '0 50px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px 0', color: '#666' }}>
          这是基于 <b>Ant Design X</b>{' '}
          全新重构的消息列表组件。它集成了思维链可视化，支持异步加载状态和自定义数据结构。
        </div>

        <Card
          styles={{
            body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' },
          }}
          style={{ flex: 1, marginBottom: 24, overflow: 'hidden' }}
        >
          <UnifiedChatList messages={messages} />
        </Card>
      </Content>
    </Layout>
  );
};

export default UnifiedChatDemo;
