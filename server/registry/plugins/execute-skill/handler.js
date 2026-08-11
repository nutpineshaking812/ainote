/**
 * 执行 Skill 插件后端处理器 (Execute Skill Plugin Handler)
 * 职责：直接调用并执行系统内配置的 Skill 实体 (如 MCP、系统 Code 等工具)
 *
 * @param {Object} params - 画布节点上配置的属性数据 (对应 manifest.json)
 * @param {Object} ctx - 插件运行时安全上下文
 */
export async function handler(params, ctx) {
  const { skillId, args, systemPrompt, model, message } = params;

  if (!skillId) {
    return {
      success: false,
      error: 'skillId is required.',
    };
  }

  // 1. 解析输入的变量载荷 (支持 JSON 格式对象或纯字符串 fallback)
  let parsedArgs = {};
  if (args) {
    if (typeof args === 'object') {
      parsedArgs = { ...args };
    } else if (typeof args === 'string') {
      try {
        parsedArgs = JSON.parse(args);
      } catch (e) {
        parsedArgs = { query: args };
      }
    }
  }

  try {
    const { default: skillService } = await import('../../../services/skill.service.js');
    const { getGlobalTools } = await import('../../../agent/tools/index.js');

    // 查找目标 Skill：db 加载 + 全局内置工具补充
    const dbSkills = await skillService.getAvailableSkills({
      userId: ctx.executorId,
      orgId: ctx.orgId,
      appId: ctx.appId,
      requestedIds: [skillId],
    });
    const allCandidates = [...dbSkills, ...getGlobalTools()];
    const skillDef = allCandidates.find(
      (s) =>
        String(s.id || s._id) === String(skillId) ||
        s.name === skillId ||
        s.id === `system:${skillId}` ||
        s.id === `builtin:${skillId}`,
    );

    if (!skillDef) {
      throw new Error(`Skill with ID "${skillId}" not found or not available in this context.`);
    }

    ctx.logger.info(
      `[ExecuteSkillPlugin] Running skill: ${skillDef.name || skillDef.id} (${skillDef.type})`,
    );

    const result = await skillService.execute(skillDef, parsedArgs, {
      userId: ctx.executorId,
      orgId: ctx.orgId,
      appId: ctx.appId,
      taskId: ctx.workflowId,
      executionId: ctx.executionId,
      sessionId: ctx.triggerData?.sessionId,
      parentExecutionId: ctx.triggerData?.parentExecutionId || ctx.executionId,
      masterSystemPrompt: systemPrompt || ctx.triggerData?.empEnhancedSystemPrompt || '',
      rootQuestion: message,
      llmConfig: { provider: model },
      onProgress: (p) => {
        if (typeof ctx.sendProgress === 'function') {
          ctx.sendProgress(p.status || 'progress', p);
        }
      },
    });

    return {
      success: true,
      result: {
        success: true,
        result,
        error: null,
      },
    };
  } catch (err) {
    ctx.logger.error({ err, skillId }, '[ExecuteSkillPlugin] Failed to execute skill');
    return {
      success: true,
      result: {
        success: false,
        result: null,
        error: err.message || String(err),
      },
    };
  }
}
