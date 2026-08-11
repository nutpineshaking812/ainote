import { EMPLOYEE_SCENARIOS } from '../../../constants/digitalEmployee.js';

/**
 * ensureConvo - 确保会话存在插件处理器
 * 作用：检查传入的 conversationId，如果不存在或为 new 则创建新会话。
 * 支持传入场景(scenario)、目标 ID(targetId)、数字人 ID(employeeId) 以及初始消息(initialMessage)。
 */
export async function handler(params, ctx) {
  // 1. 过滤未解析的模板语法或脏值
  const clean = (val) => {
    if (val === undefined || val === null) return undefined;
    const str = String(val).trim();
    if (
      str.includes('{{') ||
      str.includes('}}') ||
      str === 'undefined' ||
      str === 'null' ||
      str === ''
    ) {
      return undefined;
    }
    return val;
  };

  // console.log('TRACE_AINOTE [ensureConvo Plugin] raw inputs:', {
  //   params,
  //   triggerData: ctx.triggerData,
  // });

  // 2. 提取参数：params 有最高优先级，其次是已合并到 ctx.triggerData 外层的对应字段
  const conversationId = params.conversationId === 'new' ? 'new' : clean(params.conversationId);

  const scenario =
    clean(params.scenario) || clean(ctx.triggerData?.scenario) || EMPLOYEE_SCENARIOS.GENERAL;
  const targetId = clean(params.targetId) || clean(ctx.triggerData?.targetId);
  const employeeId =
    clean(params.employeeId) ||
    clean(ctx.triggerData?.parentEmployeeId) ||
    clean(ctx.triggerData?.employeeId);
  const initialMessage =
    clean(params.initialMessage) ||
    clean(params.message) ||
    clean(ctx.triggerData?.message) ||
    '新对话';

  const userId = ctx.executorId || clean(ctx.triggerData?.userId) || 'SYSTEM';
  const appId = ctx.appId || clean(ctx.triggerData?.appId);

  // console.log('TRACE_AINOTE [ensureConvo Plugin] resolved outputs:', {
  //   conversationId,
  //   scenario,
  //   targetId,
  //   employeeId,
  //   userId,
  //   appId,
  //   initialMessage,
  // });

  const { ensureConversation } = await import('../../../services/conversationService.js');

  const { conversation, isNew } = await ensureConversation(conversationId, {
    userId,
    appId,
    targetId,
    employeeId,
    scenario,
    message: initialMessage,
  });

  const resolvedId = conversation.id || conversation._id?.toString() || conversation._id;

  ctx.logger.info('[ensureConvo Plugin] conversation resolved', {
    conversationId: resolvedId,
    title: conversation.title,
    scenario: conversation.scenario,
    isNew,
  });

  return {
    success: true,
    result: {
      conversationId: resolvedId,
      title: conversation.title,
      type: conversation.scenario, // 向后兼容
      scenario: conversation.scenario,
      createdAt: conversation.createdAt ? new Date(conversation.createdAt).toISOString() : null,
      isNew,
    },
  };
}
