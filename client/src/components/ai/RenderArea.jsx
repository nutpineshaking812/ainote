// 中文注释: RenderArea 用于展示图表或占位提示。使用 ECharts 渲染。
import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Empty } from 'antd';

export default function RenderArea({ chartConfig }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    let instance = echarts.getInstanceByDom(ref.current);
    if (!instance) instance = echarts.init(ref.current);
    if (chartConfig) {
      instance.setOption(chartConfig);
    } else {
      instance.clear();
    }
    const handleResize = () => instance.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [chartConfig]);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        border: '1px solid #eee',
        borderRadius: 4,
        position: 'relative',
      }}
    >
      {!chartConfig && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Empty description="暂无图表" />
        </div>
      )}
      <div ref={ref} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
