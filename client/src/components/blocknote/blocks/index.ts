import React from 'react';
import { createRoot } from 'react-dom/client';
import { createCustomSchema } from '@shared/blocknote';
import { CustomCodeBlockView } from './CustomCodeBlockView';
import { CustomDocMentionView } from './CustomDocMentionView';

export { CustomCodeBlockView, CustomDocMentionView };

// ==========================================
// 统一提供集成所有 React 自定义块的 customSchema 导出
// ==========================================
export const customSchema = createCustomSchema({
  dependencies: {
    React,
    createRoot,
    CustomCodeBlockView,
    CustomDocMentionView,
  },
});

export default customSchema;
