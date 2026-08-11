# ECharts 组件快速启动

## ✅ 已完成的工作

### 1. 核心组件 (`src/components/EChartsComponent.jsx`)

- ✅ 8 种图表类型完整支持（bar、line、pie、radar、gauge、scatter、heatmap、wordcloud）
- ✅ 响应式布局（ResizeObserver）
- ✅ 自动重绘和缓存管理
- ✅ 加载状态支持
- ✅ 主题切换（light/dark）
- ✅ 生命周期管理和错误处理

### 2. 辅助工具 (`createChartOption`)

预定义的配置生成器，快速创建图表而无需写大量 ECharts 配置。

### 3. 聊天集成组件 (`src/components/ChatChartRenderer.jsx`)

专为 AI 对话设计的图表渲染器，自动处理图表配置验证和加载状态。

### 4. 文档和示例

- 完整 API 文档（`ECHARTS_GUIDE.md`）
- 演示页面（`src/pages/EChartsDemo.jsx`）
- 集成示例（`src/utils/chartIntegration.js`）

## 🚀 快速开始

### 第一步：基础使用

```jsx
import EChartsComponent, { createChartOption } from '@/components/EChartsComponent';

export default function MyChart() {
  // 创建数据
  const option = createChartOption('bar', {
    xAxis: ['周一', '周二', '周三', '周四', '周五'],
    legend: ['销售额'],
    series: [{ name: '销售额', data: [120, 200, 150, 80, 70] }],
  });

  // 渲染组件
  return <EChartsComponent type="bar" option={option} title="周销售数据" height={400} />;
}
```

### 第二步：在聊天中使用

```jsx
import ChatChartRenderer from '@/components/ChatChartRenderer';

// 在聊天消息中渲染
<ChatChartRenderer
  chartConfig={{
    type: 'pie',
    title: '分布统计',
    option: {
      /* ECharts option */
    },
  }}
  loading={false}
/>;
```

### 第三步：处理 AI 流式响应

后端发送图表事件：

```json
{
  "type": "chart",
  "data": {
    "chartConfig": {
      "type": "bar",
      "option": {
        /* ... */
      }
    }
  }
}
```

前端接收并渲染：

```jsx
const handleChartEvent = (data) => {
  addMessage({
    type: 'chart',
    chartConfig: data.chartConfig,
  });
};
```

## 📊 支持的图表类型

| 图表   | 类型值      | 用途         | 最佳数据量       |
| ------ | ----------- | ------------ | ---------------- |
| 柱状图 | `bar`       | 分类数据对比 | 5-20 个类别      |
| 折线图 | `line`      | 趋势展示     | 10-100+ 个数据点 |
| 饼图   | `pie`       | 比例展示     | 2-8 个类别       |
| 雷达图 | `radar`     | 多维度对比   | 3-8 个维度       |
| 仪表盘 | `gauge`     | 单值展示     | 1 个数值         |
| 散点图 | `scatter`   | 相关性分析   | 50+ 个点         |
| 热力图 | `heatmap`   | 矩阵数据展示 | 较密集的矩阵     |
| 词云   | `wordcloud` | 词频展示     | 10+ 词条         |

## 🎯 使用场景

### 场景1：数据分析报表

```jsx
// 前端请求 AI 分析
fetchAnalysis('分析销售数据').then((result) => {
  // 后端返回图表配置
  showChart(result.chartConfig);
});
```

### 场景2：实时监控面板

```jsx
// 定期更新数据
useEffect(() => {
  const interval = setInterval(() => {
    fetchMetrics().then((metrics) => {
      setChartOption(generateChartOption(metrics));
    });
  }, 5000);

  return () => clearInterval(interval);
}, []);
```

### 场景3：导出报告

```jsx
const exportReport = () => {
  const url = chartRef.current.getDataURL({ type: 'png' });
  downloadFile(url, 'report.png');
};
```

## 🔧 配置参考

### 基础 Props

```tsx
interface EChartsComponentProps {
  type?: 'bar' | 'line' | 'pie' | 'radar' | 'gauge' | 'scatter' | 'heatmap' | 'wordcloud';
  option?: any; // ECharts 配置对象
  title?: string; // 图表标题
  height?: number; // 高度，默认 400px
  loading?: boolean; // 加载中
  theme?: 'light' | 'dark';
  onReady?: (chart) => void;
}
```

### createChartOption 参数

```tsx
// Bar 图表
createChartOption('bar', {
  xAxis: string[];        // X 轴类别
  legend: string[];       // 图例
  series: Array<{
    name: string;
    data: number[];
  }>;
});

// Pie 图表
createChartOption('pie', {
  legend: string[];
  pieData: Array<{ name: string; value: number }>;
});

// 其他类型类似...
```

## 📈 性能优化建议

1. **大数据集处理**
   - 对 >1000 条数据进行采样或分页
   - 使用虚拟滚动处理长列表

2. **内存管理**
   - 及时调用 `chart.dispose()`
   - 避免创建过多图表实例

3. **渲染优化**
   - 使用 `React.memo` 包装组件
   - 避免频繁的 option 重新创建

## 🎨 主题定制

```jsx
// 使用深色主题
<EChartsComponent theme="dark" {...props} />;

// 自定义颜色
const customOption = {
  color: ['#5470c6', '#ee6666', '#91cc75'],
  // ... 其他配置
};
```

## 🧪 测试演示

访问演示页面查看所有图表类型的交互示例：

```bash
# 开发模式运行
npm run dev

# 访问 http://localhost:5000/echarts-demo
```

## 📋 检查清单

- [ ] 已安装 echarts 依赖
- [ ] 已导入 EChartsComponent 和 createChartOption
- [ ] 已传入必要的 props (type, option)
- [ ] 已设置合适的高度（height）
- [ ] 已处理加载状态（loading）
- [ ] 已测试响应式布局
- [ ] 已测试主题切换

## 🆘 常见问题

**Q: 图表不显示？**

- 检查容器是否有宽度和高度
- 确保 `option` 不为空
- 查看浏览器控制台是否有错误

**Q: 性能问题？**

- 减少数据量
- 使用数据采样
- 避免频繁更新

**Q: 如何导出图表？**

```jsx
const url = chartRef.current.getDataURL({ type: 'png' });
const a = document.createElement('a');
a.href = url;
a.download = 'chart.png';
a.click();
```

## 📚 相关文件

- `src/components/EChartsComponent.jsx` - 核心组件
- `src/components/ChatChartRenderer.jsx` - 聊天集成
- `src/pages/EChartsDemo.jsx` - 演示页面
- `src/utils/chartIntegration.js` - 集成工具
- `ECHARTS_GUIDE.md` - 完整文档

## 🎉 下一步

1. ✅ 集成到现有 AI 聊天流程
2. ✅ 测试各种数据场景
3. ✅ 根据需求自定义样式和交互
4. ✅ 添加导出、下载功能
5. ✅ 性能监测和优化
