// 图表数据生成节点
// 输入: state（包含 pipeline_query 查询后的 data 和 taskState）
// 输出: { chartData }，供图表组件直接使用
import { createLangChainChatOpenAI } from '../llm/index.js';
import { extractJson } from "../../utils/stringUtils.js";
import { HumanMessage } from "@langchain/core/messages";
import { PROMPT_BUILD_CHART_DATA } from './prompts/buildChartData.js';
import { dispatchEvent } from '../../utils/langgraphUtils.js';
import { eventType } from './index.js';


async function chartDataNode(state) {
  const { data, taskState } = state;
  if (!data || !Array.isArray(data)) {
    return { chartData: [] };
  }
  dispatchEvent(eventType.STATUS, { content: '准备生成图表数据，图表类型:' + taskState.output_format });
  const prompt = generateChartPromptByType(data, taskState.output_format);

  state.messages.push(new HumanMessage({ content: prompt }));

  const model = createLangChainChatOpenAI();
  const response = await model.invoke(state.messages);

  let chartData = [];
  try {
    // console.log('LLM 图表数据生成结果:', response.content);
    const jsonStr = extractJson(response.content, '');
    // console.log('提取到的图表数据 JSON 字符串:', jsonStr);
    chartData = JSON.parse(jsonStr);
  } catch (e) {
    chartData = [];
    // console.error('解析图表数据 JSON 失败:', e);
  }
  dispatchEvent(eventType.MESSAGE, { content: '生成的图表数据:' + JSON.stringify(chartData, null, 2) });
  return { messages: [response]};
}


// 折线图
function generateLineConfig(raw_data) {
  return generateChartPrompt(
    raw_data, "Line",
    { x_field: "date", y_field: "count", series_field: "platform" },
    {
      x_value: "来自【原始数据】中 'ios' 或 'android' 对象的 'key'",
      y_value: "来自【原始数据】中 'ios' 或 'android' 对象的 'value'",
      series_value: "来自【原始数据】的顶层 'key'"
    },
    {
      title: "每日活跃用户 (iOS vs Android)",
      x_label: "日期", y_label: "活跃数量", series_label: "平台"
    }
  );
}

// 柱状图
function generateColumnConfig(raw_data) {
  return generateChartPrompt(
    raw_data, "Column",
    { x_field: "date", y_field: "count", series_field: "platform" },
    {
      x_value: "来自【原始数据】中 'ios' 或 'android' 对象的 'key'",
      y_value: "来自【原始数据】中 'ios' 或 'android' 对象的 'value'",
      series_value: "来自【原始数据】的顶层 'key'"
    },
    {
      title: "每日活跃用户 (iOS vs Android)",
      x_label: "日期", y_label: "活跃数量", series_label: "平台"
    }
  );
}

// 饼图
function generatePieConfig(raw_data) {
  return generateChartPrompt(
    raw_data, "Pie",
    { angle_field: "value", color_field: "category" },
    {
      angle_value: "来自【原始数据】的 'value'",
      color_value: "来自【原始数据】的 'key'"
    },
    { title: "各类目占比", color_label: "类目" }
  );
}

// 雷达图
function generateRadarConfig(raw_data) {
  return generateChartPrompt(
    raw_data, "Radar",
    { x_field: "metric", y_field: "score", series_field: "user" },
    {
      x_value: "来自【原始数据】中 'UserA' 或 'UserB' 对象的 'key' (例如 'Attack')",
      y_value: "来自【原始数据】中 'UserA' 或 'UserB' 对象的 'value' (例如 80)",
      series_value: "来自【原始数据】的顶层 'key' (例如 'UserA')"
    },
    { title: "用户能力雷达图", y_label: "分数", series_label: "用户" }
  );
}

// 词云图
function generateWordCloudConfig(raw_data) {
  return generateChartPrompt(
    raw_data, "WordCloud",
    { word_field: "text", weight_field: "frequency" },
    {
      word_value: "来自【原始数据】的 'key'",
      weight_value: "来自【原始数据】的 'value'"
    },
    { title: "热门技术词云" }
  );
}

// 仪表盘
function generateGaugeConfig(raw_data) {
  return generateChartPrompt(
    raw_data, "Gauge",
    { value_field: "percent" },
    {
      value_logic: "此图表只有一个值。请通过【原始数据】中的 'completed' / 'total' 来计算这个值，结果应为 0 到 1 之间的小数。"
    },
    { title: "任务完成率" }
  );
}

/**
 * @param {object} raw_data
 * @param {string} chart_type
 * @param {object} mapping
 * @param {object} mapping_desc
 * @param {object} presentation
 * @returns {Promise<object>}
 * @throws {Error}
 */
function generateChartPrompt(raw_data, chart_type, mapping, mapping_desc, presentation) {
  const rules = {
    chartType: chart_type,
    mapping: mapping,
    mapping_desc: mapping_desc,
    presentation: presentation
  };

  const dataStr = JSON.stringify(raw_data, null, 2);
  const rulesStr = JSON.stringify(rules, null, 2);

  let prompt = PROMPT_BUILD_CHART_DATA.replace("{{data}}", dataStr);
  prompt = prompt.replace("{{rules}}", rulesStr);
  return prompt;
}

/**
 * 根据图类型自动分发到对应的 prompt 生成方法
 * @param {object} raw_data
 * @param {string} chart_type
 * @returns {string} prompt
 */
function generateChartPromptByType(raw_data, chart_type) {
  // 'lineChart', 'columnChart', 'pieChart', 'radarChart', 'wordCloud', 'gauge'
  switch (chart_type) {
    case 'lineChart':
      return generateLineConfig(raw_data);
    case 'columnChart':
      return generateColumnConfig(raw_data);
    case 'pieChart':
      return generatePieConfig(raw_data);
    case 'radarChart':
      return generateRadarConfig(raw_data);
    case 'wordCloud':
      return generateWordCloudConfig(raw_data);
    case 'gauge':
      return generateGaugeConfig(raw_data);
    default:
      throw new Error('不支持的图表类型: ' + chart_type);
  }
}

export default chartDataNode;
