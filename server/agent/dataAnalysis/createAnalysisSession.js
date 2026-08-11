// 数据分析Agent会话初始化
import crypto from 'crypto';
import { buildHistoryMessage } from '../utils/build_message.js';

/**
 * 初始化数据分析 Agent 会话对象
 * @property {string} userId - 用户ID
 * @property {string} appId - 应用ID
 * @property conversationId - 用户获取历史消息的会话ID
 */
async function createAnalysisSession(userId, appId, conversationId) {
  const session = {
    messages: [], // 消息历史
    taskState: {
      intent: null, // 分析意图
      data_source: null, // 数据源（表单名）
      title: null, // 存储用户指定或你建议的 *图表标题*, e.g., "按城市划分的销售额分布"
      form_id: null, // 主表单ID
      form_ids: [], // 相关表单ID集合
      dimensions: [], // 分析维度
      metrics: [], // 分析指标
      filters: {}, // 过滤条件
      output_format: null, // 'lineChart', 'columnChart', 'pieChart', 'radarChart', 'wordCloud', 'gauge'
      dynamic_metadata: {
        dim_unique_values: {}, // (可选) 存储多系列分析中，第二个维度的唯一值列表。e.g., {"城市": ["北京", "上海", "广州"]}
      },
      status: 'incomplete', // 任务状态
    },
    schema: null, // 当前数据结构（如表结构、聚合结果字段等）
    data: null, // 最终分析结果数据
    forms: null, // 可用表单/数据源信息
    pipeline: null, // 当前聚合管道
    lastToolError: null, // 最近一次工具调用的错误信息
    appId,
    userId,
    taskId: crypto.randomUUID(),
  };
  session.messages = await buildHistoryMessage(conversationId);
  return session;
}

export default createAnalysisSession;
