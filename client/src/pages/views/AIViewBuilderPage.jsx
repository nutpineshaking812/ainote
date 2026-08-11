// import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
// import { Layout, Button, Space, Typography } from 'antd';
// import { ArrowLeftOutlined, PieChartOutlined, AlignRightOutlined } from '@ant-design/icons';
// // Conversation & chat logic moved into reusable chat feature components
// // import ConversationThreads from '../../components/ai/ConversationThreads.jsx';
// // import useConversationHistory from '../../hooks/useConversationHistory.js';

// import { listConversations, getConversationMessages } from '../../api/conversations';
// import { useNavigate, useParams } from 'react-router-dom';
// import UserAvatarDropdown from '../../components/UserAvatarDropdown.jsx';
// import { Conversations } from '@ant-design/x';
// import ChatMessageList from '../../features/chat/components/MessageList.jsx';
// import ChartPreviewPanel from '../../components/ai/ChartPreviewPanel.jsx';
// import SmartSender from '../../features/chat/components/AnalysisSender.jsx';
// import { ChatProvider } from '../../features/chat/context/ChatProvider.jsx';
// import ChatWorkspace from '../../features/chat/components/ChatWorkspace.jsx';

// const { Header, Content } = Layout;
// const { Title, Paragraph } = Typography;

// // Ant Design X Conversations expects each item's `content` to be an array
// // of segment objects e.g. [{ type: 'text', text: 'message' }]. We normalize
// // to that shape to avoid silent render failures when passing plain strings.
// // 初始占位线程与引导消息
// const initialMessages = [
//   {
//     id: 'welcome-1',
//     role: 'assistant',
//     segments: [
//       { type: 'text', text: '你好，我是视图助手。告诉我你的数据展示目标，我会帮你规划视图。' },
//     ],
//     createdAt: Date.now(),
//   },
//   {
//     id: 'welcome-2',
//     role: 'assistant',
//     segments: [{ type: 'text', text: '例如：“展示近30天各渠道线索转化率的趋势并进行对比”。' }],
//     createdAt: Date.now() + 600,
//   },
// ];

// const suggestionPresets = [
//   '展示近30天的订单趋势并用折线图对比渠道',
//   '按客户等级统计本月活跃度并生成柱状图',
//   '分析各省份的销售占比并建议使用地图视图',
//   '对比今年与去年季度收入并生成多序列图',
// ];

// const AIViewBuilderPage = () => {
//   const navigate = useNavigate();
//   const { appId } = useParams();

//   // const [conversationId, setConversationId] = useState(null);

//   const handleBack = () => {
//     if (appId) {
//       navigate(`/apps/${appId}/views/new`);
//       return;
//     }
//     navigate(-1);
//   };

//   const loadThreadsFn = useCallback(async () => {
//     const data = await listConversations(appId, { scenario: 'VIEW_DESIGN', limit: 50 });
//     return data.items || [];
//   }, [appId]);

//   return (
//     <Layout style={{ minHeight: '100vh', background: '#ffffff' }}>
//       <Header
//         style={{
//           background: '#ffffff',
//           padding: '0 32px',
//           borderBottom: '1px solid #f0f0f0',
//           display: 'flex',
//           alignItems: 'center',
//           justifyContent: 'space-between',
//         }}
//       >
//         <Space size={16} align="center">
//           <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBack} />
//           <Title level={4} style={{ margin: 0 }}>
//             AI 创建视图
//           </Title>
//         </Space>
//         <UserAvatarDropdown />
//       </Header>

//       <Content style={{ padding: '0px 0px', flex: 1, direction: 'row', display: 'flex' }}>
//         <ChatProvider
//           requestPath={`/ai/chat/${appId}/stream`}
//           initialMessages={initialMessages}
//           loadThreadsFn={loadThreadsFn}
//         >
//           <ChatWorkspace
//             appId={appId}
//             suggestions={suggestionPresets}
//             renderAboveMessages={(msgs) => <ChartPreviewPanel messages={msgs} />}
//           />
//         </ChatProvider>
//       </Content>
//     </Layout>
//   );
// };

// export default AIViewBuilderPage;
