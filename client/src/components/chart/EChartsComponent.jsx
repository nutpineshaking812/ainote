import React, { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import { Empty, Spin } from 'antd';

/**
 * EChartsComponent - 通用 ECharts 图表组件
 * 支持多种图表类型，自适应响应式布局
 *
 * @param {Object} props
 * @param {string} props.type - 图表类型: 'bar'|'line'|'pie'|'radar'|'gauge'|'scatter'|'heatmap'|'wordCloud'
 * @param {Object} props.option - ECharts 配置对象
 * @param {string} props.title - 图表标题
 * @param {number} props.height - 图表高度（px），默认 400
 * @param {boolean} props.loading - 是否加载中
 * @param {string} props.theme - 主题，'light'|'dark'，默认 'light'
 * @param {Function} props.onReady - 图表初始化完成回调
 */
const EChartsComponent = React.forwardRef(
  (
    {
      type = 'bar',
      option = {},
      title = '',
      height = 400,
      loading = false,
      theme = 'light',
      onReady = null,
    },
    ref,
  ) => {
    const containerRef = useRef(null);
    const chartRef = useRef(null);
    const resizeObserverRef = useRef(null);

    // 初始化图表
    useEffect(() => {
      if (!containerRef.current) return;

      try {
        const existingInstance = echarts.getInstanceByDom(containerRef.current);
        if (existingInstance) {
          existingInstance.dispose();
        }
        chartRef.current = echarts.init(containerRef.current, theme);

        if (onReady && typeof onReady === 'function') {
          onReady(chartRef.current);
        }
      } catch (error) {
        console.error('Failed to initialize ECharts:', error);
      }

      return () => {
        if (chartRef.current) {
          chartRef.current.dispose();
          chartRef.current = null;
        }
      };
    }, [theme, onReady]);

    // 设置图表选项
    useEffect(() => {
      if (!chartRef.current) return;

      const finalOption = {
        ...option,
        title: title ? { text: title, ...option.title } : option.title,
      };

      try {
        chartRef.current.setOption(finalOption);
      } catch (error) {
        console.error('Failed to set ECharts option:', error);
      }
    }, [option, title]);

    // 设置加载状态
    useEffect(() => {
      if (!chartRef.current) return;

      if (loading) {
        chartRef.current.showLoading('default', {
          text: 'Loading...',
          textColor: '#000',
          maskColor: 'rgba(255, 255, 255, 0.8)',
          delay: 0,
        });
      } else {
        chartRef.current.hideLoading();
      }
    }, [loading]);

    // 响应式调整
    useEffect(() => {
      if (!containerRef.current || !chartRef.current) return;

      const handleResize = () => {
        if (chartRef.current) {
          chartRef.current.resize();
        }
      };

      // 使用 ResizeObserver 监听容器大小变化
      if (window.ResizeObserver) {
        resizeObserverRef.current = new ResizeObserver(handleResize);
        resizeObserverRef.current.observe(containerRef.current);
      }

      // 兼容：添加 window resize 监听
      window.addEventListener('resize', handleResize);

      return () => {
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
        }
        window.removeEventListener('resize', handleResize);
      };
    }, []);

    // 如果图表为空且无数据
    const isEmpty = useMemo(() => {
      return !option || Object.keys(option).length === 0 || (option.series && option.series.length === 0);
    }, [option]);

    if (isEmpty && !loading) {
      return (
        <div
          style={{
            height: `${height}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme === 'dark' ? '#1f1f1f' : '#f5f5f5',
            borderRadius: '4px',
          }}
        >
          <Empty description="暂无数据" />
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          borderRadius: '4px',
        }}
      >
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
            }}
          >
            <Spin />
          </div>
        )}
      </div>
    );
  },
);

EChartsComponent.displayName = 'EChartsComponent';

/**
 * 预定义的图表配置生成器
 */
export const createChartOption = (type, data = {}) => {
  const baseOption = {
    grid: { left: '10%', right: '10%', bottom: '10%', top: '15%', containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: data.legend || [] },
  };

  switch (type.toLowerCase()) {
    case 'bar':
    case 'columnchart':
      return {
        ...baseOption,
        xAxis: { type: 'category', data: data.xAxis || [] },
        yAxis: { type: 'value' },
        series: (data.series || []).map((s) => ({ ...s, type: 'bar' })),
      };

    case 'line':
    case 'linechart':
      return {
        ...baseOption,
        xAxis: { type: 'category', data: data.xAxis || [] },
        yAxis: { type: 'value' },
        series: (data.series || []).map((s) => ({ ...s, type: 'line', smooth: true })),
      };

    case 'pie':
    case 'piechart':
      return {
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { orient: 'vertical', left: 'left', data: data.legend || [] },
        series: [
          {
            name: data.seriesName || '数据',
            type: 'pie',
            radius: '50%',
            data: data.pieData || (data.series && data.series[0]?.data) || [],
            emphasis: {
              itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' },
            },
          },
        ],
      };

    case 'radar':
      return {
        tooltip: { trigger: 'item' },
        legend: { data: data.legend || [] },
        radar: {
          indicator: data.radarIndicator || [{ name: '指标' }],
          name: { textStyle: { color: '#666' } },
        },
        series: [
          {
            name: data.seriesName || '数据',
            type: 'radar',
            data: data.series || [],
            areaStyle: { opacity: 0.3 },
          },
        ],
      };

    case 'gauge':
      return {
        series: [
          {
            type: 'gauge',
            startAngle: 225,
            endAngle: -45,
            radius: '75%',
            center: ['50%', '50%'],
            min: 0,
            max: 100,
            splitNumber: 10,
            axisLine: {
              lineStyle: {
                width: 30,
                color: [
                  [0.3, '#67e0eb'],
                  [0.7, '#37a2da'],
                  [1, '#ef2f78'],
                ],
              },
            },
            pointer: { itemStyle: { color: 'auto' } },
            axisTick: { distance: 15 },
            splitLine: { distance: 15, length: 8 },
            axisLabel: { color: 'auto', distance: 20 },
            detail: { valueAnimation: true, formatter: '{value}%', color: 'auto' },
            data: [{ value: data.value || 50, name: data.name || '完成度' }],
          },
        ],
      };

    case 'scatter':
      return {
        ...baseOption,
        xAxis: { type: 'value' },
        yAxis: { type: 'value' },
        series: (data.series || []).map((s) => ({ ...s, type: 'scatter', symbolSize: 10 })),
      };

    case 'heatmap':
      return {
        ...baseOption,
        xAxis: { type: 'category', data: data.xAxis || [] },
        yAxis: { type: 'category', data: data.yAxis || [] },
        visualMap: { min: 0, max: 100, calculable: true, orient: 'vertical', right: '10' },
        series: [
          {
            data: data.heatmapData || [],
            type: 'heatmap',
            label: { show: true },
          },
        ],
      };

    case 'wordcloud':
      return {
        series: [
          {
            type: 'wordCloud',
            shape: 'pentagon',
            left: 'center',
            top: 'center',
            width: '100%',
            height: '100%',
            right: null,
            bottom: null,
            sizeRange: [12, 48],
            rotationRange: [-90, 90],
            rotationStep: 45,
            gridSize: Math.max(4, Math.floor(100 / (data.wordData?.length || 5))),
            seriesId: 'wordcloud',
            data: data.wordData || [],
            textStyle: {
              color: () => {
                return `hsl(${Math.random() * 360}, 80%, 50%)`;
              },
            },
            emphasis: { textStyle: { textShadowBlur: 3, textShadowColor: '#333' } },
          },
        ],
      };

    default:
      return baseOption;
  }
};

export default EChartsComponent;
