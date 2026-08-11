import React from 'react';
import UnifiedChatList from './UnifiedChatList.tsx';

/**
 * 通用消息列表封装，内部由传统的 segments 模式全量转向现代的 parts 混合内容模式
 */
export default function ChatMessageList({
  messages = [],
  loading = false,
  withAvatar = true,
  onAddChart,
  assistantAvatar, // 新增：支持自定义助理头像
  assistantName, // 助理名称，用于 fallback 首字母头像
  displayMode,
}) {
  return (
    <UnifiedChatList
      messages={messages}
      loading={loading}
      onAddChart={onAddChart}
      assistantAvatar={assistantAvatar}
      assistantName={assistantName}
      displayMode={displayMode}
    />
  );
}
