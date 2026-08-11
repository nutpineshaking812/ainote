import React from 'react';
import { Typography, Space, Divider } from 'antd';

export default function HelpContent() {
  return (
    <div style={{ maxWidth: 360, padding: '4px 0' }}>
      <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
        块编辑器快捷指南
      </Typography.Title>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <div>
          <Typography.Text strong style={{ fontSize: 13 }}>
            📝 基础格式
          </Typography.Text>
          <div style={{ marginTop: 6, fontSize: 12, color: '#666', lineHeight: 1.8 }}>
            <div>
              • 输入 <code>/</code> 打开命令菜单
            </div>
            <div>
              • 输入 <code>#</code> + 空格 → 标题
            </div>
            <div>
              • 输入 <code>-</code> + 空格 → 列表
            </div>
            <div>
              • 输入 <code>1.</code> + 空格 → 有序列表
            </div>
            <div>
              • 输入 <code>```</code> → 代码块
            </div>
            <div>
              • 输入 <code>{'>'}</code> + 空格 → 引用
            </div>
          </div>
        </div>
        <Divider style={{ margin: '8px 0' }} />
        <div>
          <Typography.Text strong style={{ fontSize: 13 }}>
            ⌨️ 快捷键
          </Typography.Text>
          <div style={{ marginTop: 6, fontSize: 12, color: '#666', lineHeight: 1.8 }}>
            <div>
              • <kbd>Cmd/Ctrl + S</kbd> - 保存文档
            </div>
            <div>
              • <kbd>Cmd/Ctrl + B</kbd> - 粗体
            </div>
            <div>
              • <kbd>Cmd/Ctrl + I</kbd> - 斜体
            </div>
            <div>• 选中文本后可快速格式化</div>
          </div>
        </div>
        <Divider style={{ margin: '8px 0' }} />
        <div>
          <Typography.Text strong style={{ fontSize: 13 }}>
            ✨ 功能特性
          </Typography.Text>
          <div style={{ marginTop: 6, fontSize: 12, color: '#666', lineHeight: 1.8 }}>
            <div>• 拖拽块可重新排序</div>
            <div>• 自动保存（3秒后）</div>
            <div>• 支持 Markdown 格式</div>
          </div>
        </div>
      </Space>
    </div>
  );
}
