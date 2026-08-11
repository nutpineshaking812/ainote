/**
 * 子工作流执行插件后端处理器 (Subworkflow Plugin Handler)
 * 职责：作为通用的插件模块，触发并管理嵌套工作流的执行，提供流式输出开关。
 *
 * @param {Object} params - 画布节点上配置的属性数据 (对应 manifest.json)
 * @param {Object} ctx - 插件运行时安全上下文
 */
export async function handler(params, ctx) {
  const { workflowId: subWorkflowId, inputData, async, enableOutput = true } = params;

  // 🌟 [ANTI-LOOP SAFETY GUARD] Nesting Depth Guard (Prevents infinite recursive loops)
  const MAX_DEPTH = 10;
  const currentDepth = ctx.triggerData?.executionDepth || 0;
  if (currentDepth >= MAX_DEPTH) {
    return {
      success: false,
      error: `执行终止：已达到工作流最大嵌套执行深度限制 (${MAX_DEPTH})，防止出现无限循环。`,
    };
  }

  if (!subWorkflowId) {
    return {
      success: false,
      error: 'Target workflowId is required.',
    };
  }

  // 1. 解析输入的变量载荷 (兼容字符串、对象或变量模板解析结果)
  let parsedInput = {};
  if (inputData) {
    if (typeof inputData === 'object') {
      parsedInput = inputData;
    } else if (typeof inputData === 'string') {
      try {
        parsedInput = JSON.parse(inputData);
      } catch (e) {
        // 退化为作为 query 传递
        parsedInput = { query: inputData };
      }
    }
  }

  // 2. 构造子工作流触发时需要的系统层级属性继承 (System Context Auto-Inheritance)
  const rawAppId = ctx.appId || parsedInput.appId || ctx.triggerData?.appId;

  // 🌟 [CORE OPTIMIZATION] 核心是否输出控制：
  // 只有当 enableOutput 开关开启时，才往下透传 parentExecutionId，以此连通 SSE 流式广播通道；
  // 关闭时，不传入 parentExecutionId，从而物理屏蔽流式进度在聊天窗口的渲染。
  const parentExecutionId = enableOutput
    ? (ctx.triggerData?.parentExecutionId || ctx.executionId)
    : undefined;

  const subTriggerData = {
    appId: rawAppId === 'null' || rawAppId === 'undefined' ? null : rawAppId,
    orgId: ctx.orgId,
    triggeredBy: ctx.executorId,
    sessionId: ctx.triggerData?.sessionId,
    sessionName: ctx.triggerData?.sessionName,
    parentExecutionId,
    executionDepth: currentDepth + 1, // 传递递增的嵌套深度
    ...parsedInput,
  };

  const crypto = await import('crypto');
  // 为子工作流生成全局唯一的执行实例 ID (保证在 255 字符以内)
  const childWorkflowId = `sub-exec-${crypto.randomUUID()}`;

  ctx.logger.info('[Subworkflow Plugin] Running subworkflow action', {
    subWorkflowId,
    async,
    enableOutput,
    childWorkflowId,
  });

  try {
    const { getTemporalClient } = await import('../../../temporal/client.js');
    const { default: env } = await import('../../../config/env.js');
    const client = await getTemporalClient();

    // ── 异步模式：触发后立即返回 ──
    if (async) {
      const handle = await client.workflow.start('runWorkflow', {
        args: [subWorkflowId, subTriggerData, childWorkflowId],
        taskQueue: env.TEMPORAL_TASK_QUEUE,
        workflowId: childWorkflowId,
      });

      return {
        success: true,
        result: {
          status: 'TRIGGERED_ASYNC',
          subWorkflowId,
          childWorkflowId: handle.workflowId,
        },
      };
    }

    // ── 同步模式：等待子工作流完整执行结束并返回结果 ──
    const result = await client.workflow.execute('runWorkflow', {
      args: [subWorkflowId, subTriggerData, childWorkflowId],
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId: childWorkflowId,
    });

    return {
      success: true,
      result: result?.end?.result || result || {},
    };
  } catch (err) {
    ctx.logger.error({ err, subWorkflowId }, '[Subworkflow Plugin] Failed to execute child workflow');
    return {
      success: false,
      error: err.message || String(err),
    };
  }
}
