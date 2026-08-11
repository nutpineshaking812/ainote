// ConversationThreads 组件：负责
// 1. 拉取指定应用(appId)的历史会话列表（按类型过滤）
// 2. 管理占位会话（在首次流式返回真实 conversationId 前展示）
// 3. 支持创建新的临时会话（前端占位，等待 SSE 返回真实 ID 后再重命名）
// 4. 向上层暴露 activeKey 变化事件，方便页面加载对应消息
//
// 设计要点：
// - 后端接口：GET /apps/:appId/conversations?type=xxx&limit=50
// - SSE 在第一次 assistant 响应时会通过 'conversation' 事件给出真实 ID，父组件监听并通过 incomingConversationId 属性传入
// - 组件内部只负责“线程列表”的重命名，不负责迁移消息；消息迁移逻辑放在父容器中保持职责单一
// - 使用 safeCall 封装错误，避免抛出未捕获 Promise 异常
// - 新会话使用前缀 thread- 时间戳生成占位 key，防止与真实 Mongo ObjectId 冲突
import React from 'react';
import { Button } from 'antd';
import { Conversations } from '@ant-design/x';

/**
 * ConversationThreads 组件属性说明：
 * threads: 线程列表（已由上层 Hook 加载）
 * loading: 列表加载状态
 * activeKey: 当前选中线程 key
 * onActiveChange: 用户点击线程时回调 (key) => void
 * onNewThread: 新建占位线程回调，由外层实现返回新 key
 * showNewButton: 是否显示“新建会话”按钮，默认 true
 */
const ConversationList = ({
  threads,
  loading,
  activeKey,
  onActiveChange,
  onNewThread,
  showNewButton = true,
}) => {
  const handleNew = () => {
    onNewThread && onNewThread();
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Conversations
          items={threads}
          loading={loading}
          groupable
          activeKey={activeKey}
          onActiveChange={(key) => onActiveChange && onActiveChange(key)}
          styles={{ item: { cursor: 'pointer' } }}
        />
      </div>
      {showNewButton && (
        <div style={{ padding: '8px 12px' }}>
          <Button block size="small" onClick={handleNew}>
            新建会话
          </Button>
        </div>
      )}
    </div>
  );
};

export default ConversationList;
