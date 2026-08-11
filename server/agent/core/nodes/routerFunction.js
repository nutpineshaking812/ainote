/**
 * 通用的基础路由函数
 * @param {Object} state - 当前状态
 * @returns {string} - 下一个节点名称
 */
export const baseRouterFunction = (state) => {
  const lastMessage = state.messages[state.messages.length - 1];

  // 检查是否有工具调用
  if (lastMessage.tool_calls?.length > 0) {
    return 'tool_executor';
  }

  return '__end__';
};

export default baseRouterFunction;
