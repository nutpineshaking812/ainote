/**
 * Zep 记忆提取插件后端处理器
 * @param {Object} params - 用户在画布节点上配置的参数 (来自 manifest.json 的 properties)
 * @param {Object} ctx - 上下文环境 (包含 triggerData, nodeResults, acts 等)
 */
export async function handler(params, ctx) {
  const { collection, topK, minScore } = params;
  const { query } = ctx.triggerData; // 拿到用户当前的提问内容

  // 这里调用 Zep 的核心 API
  // 假设我们已经初始化了 ZepClient (你以后可以在 Activity 里配置它)
  try {
    // 🚧 示例逻辑：这里实际应该调用对应的 Temporal Activity
    // const result = await ctx.acts.zepRecallActivity({ collection, query, topK, minScore });
    
    // 模拟返回数据
    return {
      success: true,
      result: {
        content: `从 Zep 集合[${collection}]中找到了与 "${query}" 相关的记忆。`,
        summary: "这是用户的长期摘要历史。",
        confidence: 0.85
      }
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}
