/**
 * 如何在 AI 聊天中渲染图表
 * 集成示例和配置参考
 */

// 1. 在聊天消息处理中添加图表类型支持
// file: src/features/chat/components/ChatMessageList.jsx

/*
import ChatChartRenderer from '@/components/ChatChartRenderer';

export default function ChatMessageList({ messages = [], loading = false }) {
  return (
    <div>
      {messages.map(msg => {
        // 检查消息类型
        if (msg.type === 'chart') {
          return (
            <div key={msg.id} className="message-item chart-message">
              <ChatChartRenderer 
                chartConfig={msg.chartConfig}
                loading={msg.loading}
              />
            </div>
          );
        }
        
        // 其他消息类型...
        return <div key={msg.id}>{msg.content}</div>;
      })}
    </div>
  );
}
*/

// 2. 后端返回的图表事件格式（参考 agentStream.controller.js）
const chartEventExample = {
  type: 'chart',
  data: {
    // 图表配置
    chartConfig: {
      type: 'bar', // 'bar'|'line'|'pie'|'radar'|'gauge'|'scatter'|'heatmap'|'wordcloud'
      title: '获奖类型分布', // 图表标题
      option: {
        // 标准 ECharts 配置
        xAxis: {
          type: 'category',
          data: ['国家级', '省级', '市级', '区县', '学校'],
        },
        yAxis: { type: 'value' },
        series: [
          {
            type: 'bar',
            data: [10, 20, 15, 12, 8],
            itemStyle: {
              color: 'rgba(54, 162, 235, 0.8)',
            },
          },
        ],
        tooltip: { trigger: 'axis' },
        grid: { left: '10%', right: '10%', bottom: '10%', containLabel: true },
      },
    },
    loading: false,
  },
};

// 3. 前端流式处理图表事件
/*
// file: src/hooks/useXAgentChat.js (or similar SSE hook)

export function useXAgentChat() {
  const handleSseEvent = (event, data) => {
    switch(event) {
      case 'chart':
        // 添加图表消息到消息列表
        addMessage({
          id: generateId(),
          type: 'chart',
          chartConfig: data.chartConfig,
          loading: false,
          createdAt: new Date()
        });
        break;
      
      case 'tool_result':
        // 如果工具结果包含可视化数据，可将其转换为图表
        if (data.result?.data && isVisualizationData(data.result)) {
          addChartFromData(data.result);
        }
        break;
      
      // ... 其他事件处理
    }
  };
}
*/

// 4. 从数据生成图表配置的工具函数
export function generateChartFromData(data, analysisType = 'bar') {
  if (!data || !Array.isArray(data)) return null;

  const { createChartOption } = require('@/components/EChartsComponent');

  if (analysisType === 'distribution') {
    // 分布分析 -> 饼图或柱状图
    const labels = data.map((d) => d._id || d.label);
    const values = data.map((d) => d.count || d.value);

    if (labels.length <= 5) {
      // 类别较少用饼图
      return {
        type: 'pie',
        title: '分布统计',
        option: createChartOption('pie', {
          legend: labels,
          pieData: data.map((d) => ({
            name: d._id || d.label,
            value: d.count || d.value,
          })),
        }),
      };
    } else {
      // 类别较多用柱状图
      return {
        type: 'bar',
        title: '分布统计',
        option: createChartOption('bar', {
          xAxis: labels,
          legend: ['数量'],
          series: [{ name: '数量', data: values }],
        }),
      };
    }
  }

  if (analysisType === 'timeseries') {
    // 时间序列 -> 折线图
    const timePoints = data.map((d) => d.time || d.date);
    const values = data.map((d) => d.value || d.count);

    return {
      type: 'line',
      title: '时间序列趋势',
      option: createChartOption('line', {
        xAxis: timePoints,
        legend: ['值'],
        series: [{ name: '值', data: values }],
      }),
    };
  }

  if (analysisType === 'comparison') {
    // 多系列对比 -> 组合柱线图
    const categories = data.map((d) => d.category);
    const series = groupBySeries(data);

    return {
      type: 'bar',
      title: '对比分析',
      option: createChartOption('bar', {
        xAxis: categories,
        legend: Object.keys(series),
        series: Object.entries(series).map(([name, values]) => ({
          name,
          data: values,
        })),
      }),
    };
  }

  return null;
}

// 5. 导出图表示例
export function downloadChart(chartInstance, filename = 'chart.png') {
  if (!chartInstance) return;

  const url = chartInstance.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: '#fff',
  });

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}

// 辅助函数
function groupBySeries(data) {
  const result = {};
  data.forEach((item) => {
    if (!result[item.series]) result[item.series] = [];
    result[item.series].push(item.value);
  });
  return result;
}

function isVisualizationData(data) {
  return data && (Array.isArray(data.data) || data.forms || data.pipeline || data.schema);
}

// 6. 样式参考 (CSS)
/*
.chart-message {
  margin: 16px 0;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.chart-message:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

@media (max-width: 768px) {
  .chart-message {
    margin: 12px 0;
    padding: 8px;
  }
}
*/

// export { generateChartFromData, downloadChart };
