# ECharts 组件使用指南

## 概述

`EChartsComponent` 是一个功能完整的 React 组件，提供对 ECharts 的最佳实践封装。支持 8 种常见图表类型，具备响应式布局、自动重绘和加载状态管理。

## 特性

- ✅ 支持 8 种图表类型（柱状、折线、饼、雷达、仪表、散点、热力、词云）
- ✅ 响应式布局（ResizeObserver + window resize）
- ✅ 自动重绘和缓存管理
- ✅ 加载状态支持
- ✅ 主题切换（light/dark）
- ✅ 组件生命周期管理
- ✅ 错误处理和空状态展示

## 安装

确保已安装依赖：

```bash
npm install echarts antd
```

## 基础用法

### 1. 简单柱状图

```jsx
import EChartsComponent, { createChartOption } from '@/components/EChartsComponent';

function MyChart() {
  const option = createChartOption('bar', {
    xAxis: ['周一', '周二', '周三', '周四', '周五'],
    legend: ['销售额'],
    series: [{ name: '销售额', data: [120, 200, 150, 80, 70] }],
  });

  return <EChartsComponent type="bar" option={option} title="周销售数据" height={400} />;
}
```

### 2. 多系列折线图

```jsx
const option = createChartOption('line', {
  xAxis: ['1月', '2月', '3月', '4月', '5月'],
  legend: ['销售额', '用户数'],
  series: [
    { name: '销售额', data: [120, 200, 150, 80, 70] },
    { name: '用户数', data: [200, 150, 250, 180, 220] },
  ],
});

return <EChartsComponent type="line" option={option} height={400} />;
```

### 3. 饼图

```jsx
const option = createChartOption('pie', {
  legend: ['搜索', '直接', '邮件', '联盟'],
  pieData: [
    { value: 1048, name: '搜索' },
    { value: 735, name: '直接' },
    { value: 580, name: '邮件' },
    { value: 484, name: '联盟' },
  ],
});

return <EChartsComponent type="pie" option={option} height={400} />;
```

### 4. 雷达图

```jsx
const option = createChartOption('radar', {
  legend: ['预算分配'],
  radarIndicator: [
    { name: '销售', max: 6500 },
    { name: '市场', max: 16000 },
    { name: '开发', max: 30000 },
  ],
  series: [{ name: '预算', value: [4200, 3000, 20000] }],
});

return <EChartsComponent type="radar" option={option} height={400} />;
```

### 5. 仪表盘

```jsx
const option = createChartOption('gauge', {
  value: 75,
  name: '系统健康度',
});

return <EChartsComponent type="gauge" option={option} height={300} />;
```

## 高级用法

### 自定义配置

```jsx
const customOption = {
  title: { text: '自定义标题' },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: ['A', 'B', 'C'] },
  yAxis: { type: 'value' },
  series: [
    {
      data: [10, 20, 30],
      type: 'bar',
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#83bff6' },
          { offset: 0.5, color: '#188df0' },
          { offset: 1, color: '#188df0' },
        ]),
      },
    },
  ],
};

return <EChartsComponent type="bar" option={customOption} height={400} />;
```

### 使用 ref 获取图表实例

```jsx
import { useRef } from 'react';

function MyChart() {
  const chartRef = useRef(null);

  const handleExport = () => {
    if (chartRef.current) {
      const url = chartRef.current.getDataURL({
        type: 'png',
        pixelRatio: 2,
      });
      // 下载图片
    }
  };

  return (
    <>
      <EChartsComponent ref={chartRef} type="bar" option={option} />
      <button onClick={handleExport}>导出图片</button>
    </>
  );
}
```

### 加载状态

```jsx
const [loading, setLoading] = useState(false);

useEffect(() => {
  setLoading(true);
  fetchData().then((data) => {
    setOption(data);
    setLoading(false);
  });
}, []);

return <EChartsComponent type="bar" option={option} loading={loading} height={400} />;
```

## 在 AI 聊天中集成

### ChatChartRenderer 组件

```jsx
import ChatChartRenderer from '@/components/ChatChartRenderer';

function ChatMessage({ message }) {
  if (message.type === 'chart') {
    return <ChatChartRenderer chartConfig={message.chartConfig} loading={message.loading} />;
  }

  return <div>{message.content}</div>;
}
```

### 接收 AI 图表配置

```jsx
// 从 AI 服务接收的图表配置格式
const chartConfig = {
  type: 'bar',
  title: '销售分析',
  option: {
    xAxis: { type: 'category', data: [...] },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: [...] }]
  }
};
```

## Props 文档

| Props   | 类型     | 默认值  | 说明                    |
| ------- | -------- | ------- | ----------------------- |
| type    | string   | 'bar'   | 图表类型                |
| option  | object   | {}      | ECharts 配置对象        |
| title   | string   | ''      | 图表标题                |
| height  | number   | 400     | 图表高度（px）          |
| loading | boolean  | false   | 是否加载中              |
| theme   | string   | 'light' | 主题（'light'\|'dark'） |
| onReady | function | null    | 图表初始化完成回调      |

## 支持的图表类型

| 类型      | createChartOption 参数             |
| --------- | ---------------------------------- |
| bar       | { xAxis, legend, series }          |
| line      | { xAxis, legend, series }          |
| pie       | { legend, pieData }                |
| radar     | { legend, radarIndicator, series } |
| gauge     | { value, name }                    |
| scatter   | { series }                         |
| heatmap   | { xAxis, yAxis, heatmapData }      |
| wordcloud | { wordData }                       |

## 最佳实践

1. **性能优化**
   - 对大数据集（>1000 条）进行采样或分页
   - 使用 `key` 属性避免不必要的重绘
   - 及时释放图表资源

2. **用户体验**
   - 在数据加载时显示 loading 状态
   - 提供空状态提示
   - 使用合适的图表高度

3. **响应式**
   - 依赖组件的响应式调整，无需手动处理
   - 容器宽度由父元素决定

4. **主题**
   - 支持深色模式，传入 `theme="dark"`
   - 根据全局主题动态调整

## 常见问题

### Q: 如何导出图表为图片？

```jsx
const chartRef = useRef();

const exportChart = () => {
  const url = chartRef.current.getDataURL({ type: 'png' });
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chart.png';
  a.click();
};
```

### Q: 如何处理图表数据更新？

直接更新 `option` prop，组件会自动重绘。

### Q: 支持实时更新吗？

支持，每次 `option` 变化时会自动更新图表。

### Q: 如何自定义颜色？

在 `option` 中通过 `color` 数组或 `itemStyle` 自定义。

## 演示页面

访问 `/pages/EChartsDemo.jsx` 查看所有图表类型的交互演示。
