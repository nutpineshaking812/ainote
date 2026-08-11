/**
 * 协同数字员工插件后端处理器 (Collaborator Addon Plugin Handler)
 * 职责：作为 Addon 节点，主要在 AI Agent 编排时提供连线信息。直接运行时仅返回配置的 employeeId。
 *
 * @param {Object} params - 画布节点上配置的属性数据 (对应 manifest.json)
 * @param {Object} ctx - 插件运行时安全上下文
 */
export async function handler(params, ctx) {
  const { employeeId } = params;

  if (!employeeId) {
    return {
      success: false,
      error: 'employeeId is required.',
    };
  }

  return {
    success: true,
    employeeId,
  };
}
