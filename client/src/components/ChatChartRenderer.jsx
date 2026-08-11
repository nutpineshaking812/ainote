import React, { useMemo } from 'react';
import EChartsComponent, { createChartOption } from './chart/EChartsComponent';
import { Empty, Spin } from 'antd';

/**
 * ChatChartRenderer - 在聊天消息中渲染图表
 * 用于 AI 分析结果可视化
 */
const ChatChartRenderer = ({ chartConfig, loading = false }) => {
  // 验证图表配置的有效性
  const validConfig = useMemo(() => {
    if (!chartConfig) return null;

    const { type, option, title } = chartConfig;
    if (!type || !option) return null;

    return { type, option, title };
  }, [chartConfig]);

  if (loading) {
    return <Spin style={{ display: 'block', textAlign: 'center', padding: '40px' }} />;
  }

  if (!validConfig) {
    return <Empty description="图表配置无效" style={{ padding: '20px' }} />;
  }

  return (
    <div style={{ marginTop: '16px', marginBottom: '16px', width: '100%' }}>
      <EChartsComponent
        type={validConfig.type}
        option={validConfig.option}
        title={validConfig.title}
        height={400}
        loading={loading}
      />
    </div>
  );
};

export default ChatChartRenderer;
