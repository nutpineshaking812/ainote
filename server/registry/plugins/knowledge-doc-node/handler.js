/**
 * 知识文档插件处理器
 * 职责：简单透传所选的知识文档 IDs，供连接的 target 节点（如 deep-agent）解析。
 */
export async function handler(params, execCtx) {
  return {
    success: true,
    result: {
      knowledgeIds: params.knowledgeIds,
      label: params.label || '知识文档'
    }
  };
}
