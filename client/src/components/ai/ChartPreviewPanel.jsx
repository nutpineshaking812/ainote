// ChartPreviewPanel 占位组件
// 未来职责：
// - 接收 agent 运行结果中的 chartConfig / data
// - 动态渲染 ECharts / AntV 图表
// - 提供下载 / 复制配置 / 切换图类型能力
// 目前：简单显示最近一条包含 "chart" 字样的 assistant 消息片段

import React, { useMemo } from 'react';
import { Card, Empty } from 'antd';

const ChartPreviewPanel = ({ messages }) => {
  const chartHint = useMemo(() => {
    if (!Array.isArray(messages)) return null;
    // 查找最后一条 assistant 消息里含有 "chart" 关键词的文本
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== 'assistant') continue;
      const text = m.segments?.map((s) => s.text).join('\n') || '';
      if (/chart|图|折线|柱状|饼图|趋势/i.test(text)) return text.slice(0, 300);
    }
    return null;
  }, [messages]);

  return (
    <Card
      size="small"
      title="图表预览（占位）"
      style={{ marginBottom: 12, display: 'none' }}
      bodyStyle={{ padding: 12 }}
    >
      {chartHint ? (
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{chartHint}</pre>
      ) : (
        <Empty description="暂无可预览的图表相关内容" />
      )}
    </Card>
  );
};

export default ChartPreviewPanel;
