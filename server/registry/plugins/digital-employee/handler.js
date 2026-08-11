/**
 * 数字员工执行插件后端处理器 (Digital Employee Plugin Handler)
 * 职责：作为通用的插件模块，触发并管理特定数字员工的对话逻辑。
 *
 * @param {Object} params - 画布节点上配置的属性数据 (对应 manifest.json)
 * @param {Object} ctx - 插件运行时安全上下文
 */
export async function handler(params, ctx) {
  const { employeeId, message, async = false } = params;

  // 🌟 [ANTI-LOOP SAFETY GUARD] Direct Self-Recursive Call Guard
  if (employeeId === ctx.triggerData?.employeeId) {
    return {
      success: false,
      error: `检测到循环调用：数字员工无法在自身大脑工作流中递归调用自身。`,
    };
  }

  // 🌟 [ANTI-LOOP SAFETY GUARD] Nesting Depth Guard (Prevents indirect infinite recursive loops)
  const MAX_DEPTH = 10;
  const currentDepth = ctx.triggerData?.executionDepth || 0;
  if (currentDepth >= MAX_DEPTH) {
    return {
      success: false,
      error: `执行终止：已达到数字员工最大嵌套执行深度限制 (${MAX_DEPTH})，防止出现无限循环。`,
    };
  }

  if (!employeeId) {
    return {
      success: false,
      error: 'employeeId is required.',
    };
  }

  try {
    const { default: deService } = await import('../../../services/digitalEmployee.service.js');
    const { getTemporalClient } = await import('../../../temporal/client.js');
    const { default: env } = await import('../../../config/env.js');

    // 💡 重点：在插件 Handler 内部动态扫描拓扑图连线以收集协同的子数字员工
    const collaboratorIds = [];
    if (ctx.workflowId && ctx.nodeId) {
      try {
        const { default: workflowService } = await import('../../../services/workflow.service.js');
        const parentWorkflow = await workflowService.getWorkflowById(ctx.orgId, ctx.workflowId);

        if (parentWorkflow && Array.isArray(parentWorkflow.edges)) {
          const collaboratorEdges = parentWorkflow.edges.filter(
            (e) => e.target === ctx.nodeId && e.targetHandle === 'collaborator-slot',
          );

          collaboratorEdges.forEach((edge) => {
            const sourceNode = parentWorkflow.nodes.find((n) => n.id === edge.source);
            const empId =
              sourceNode?.data?.employeeId || sourceNode?.data?.pluginParams?.employeeId;
            if (empId && !collaboratorIds.includes(empId)) {
              collaboratorIds.push(empId);
            }
          });
        }
      } catch (err) {
        ctx.logger.warn(
          { err, workflowId: ctx.workflowId },
          'Failed to scan collaborator edges in digital employee handler',
        );
      }
    }

    // 1. 组装输入参数与系统环境变量
    const resolvedMessage = message || ctx.triggerData?.message || ctx.triggerData?.query;
    const triggerData = {
      message: resolvedMessage,
      query: resolvedMessage,
      triggeredBy: ctx.executorId || 'SYSTEM',
      orgId: ctx.orgId,
      appId: ctx.appId || ctx.triggerData?.appId,
      userId: ctx.triggerData?.userId,
      sessionId: ctx.triggerData?.sessionId,
      sessionName: ctx.triggerData?.sessionName,
      employeeId, // 在 triggerData 中追踪当前员工 ID，用作递归检测
      parentEmployeeId: ctx.triggerData?.employeeId, // 调用方（父）数字员工 ID，子员工可感知调用链路
      executionDepth: currentDepth + 1, // 传递递增的嵌套深度
      // 保持 SSE 推送消息链路，将当前执行实例 ID 作为 parentExecutionId 往下透传
      parentExecutionId: ctx.triggerData?.parentExecutionId || ctx.executionId,
      scenario: ctx.triggerData?.scenario,
      targetId: ctx.triggerData?.targetId,
    };

    // 2. 加载数字员工对应大脑工作流的配置与合并好的预设参数 (如性格描述、绑定的知识库等)
    const { workflowId, mergedData } = await deService.getExecutionConfig(employeeId, triggerData);

    // 💡 核心数据增强：将协同数字员工的 Brain 工作流及角色导则注入到独立的增强参数中，防止属性冲突。
    // 主数字员工在其大脑工作流中可以通过 {{trigger.empEnhancedSkillIds}} 和 {{trigger.empEnhancedSystemPrompt}} 来按需读取并进行数据增强。
    const empEnhancedSkillIds = [];
    const collaboratorSops = [];

    for (const cid of collaboratorIds) {
      if (!cid) continue;
      try {
        const emp = await deService.getEmployeeById(cid);
        if (!emp || !emp.workflowId) continue;

        // 1. 收集协同员工的 ID
        const empSkillId = `emp_${cid}`;
        if (!empEnhancedSkillIds.includes(empSkillId)) {
          empEnhancedSkillIds.push(empSkillId);
        }

        // 2. 组装提示语导则
        let cleanName = emp.name.replace(/[^a-zA-Z0-9_]/g, '');
        if (!cleanName) {
          cleanName = `employee_${cid.toString().slice(-4)}`;
        } else {
          cleanName = `${cleanName}_${cid.toString().slice(-4)}`;
        }
        const toolName = `delegate_to_${cleanName}`;
        collaboratorSops.push(`Teammate [${emp.name}] (Role: ${emp.roleTitle || 'Collaborator'}):
- Focus & Specialty: ${emp.description || 'A helpful collaborative expert.'}
- How to consult them: Call the "${toolName}" tool whenever their expertise is needed for a task.`);
      } catch (err) {
        ctx.logger.error(
          { err, collaboratorId: cid },
          'Failed to resolve collaborator details in digital-employee handler',
        );
      }
    }

    if (collaboratorSops.length > 0) {
      const teammatesBriefing = `\n\n### Roundtable Teammates (圆桌会协同团队)
You are collaborating with a team of specialized digital employees. You can delegate sub-tasks to them using their respective tools. Here are your teammates:

${collaboratorSops.join('\n\n')}

Guidance on delegation:
1. Identify when a sub-task or domain-specific problem belongs to a teammate's expertise.
2. Delegate the task to them immediately by calling their tool rather than trying to do everything yourself.
3. Once they return their compiled results, incorporate their output into your final response.`;

      mergedData.empEnhancedSkillIds = empEnhancedSkillIds;
      mergedData.empEnhancedSystemPrompt = teammatesBriefing;
    } else {
      mergedData.empEnhancedSkillIds = [];
      mergedData.empEnhancedSystemPrompt = '';
    }

    const client = await getTemporalClient();
    const crypto = await import('crypto');

    // 按照极简路径规范为运行大模型对话生成唯一的 Temporal 工作流 ID，带上中文名字和角色
    let empInfo = employeeId.toString().slice(-4);
    try {
      const emp = await deService.getEmployeeById(employeeId);
      if (emp) {
        const safeName = emp.name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '');
        const safeRole = (emp.roleTitle || '员工').replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '');
        empInfo = safeRole ? `${safeName}_${safeRole}` : safeName;
      }
    } catch (e) {
      // Ignore and fallback
    }

    const parentPrefix = ctx.executionId ? `e_${ctx.executionId.substring(0, 8)}` : 'e_ext';
    const uniqueSuffix = crypto.randomUUID().substring(0, 8);
    const childWorkflowId = `${parentPrefix}:de_${empInfo}:${uniqueSuffix}`;

    ctx.logger.info('[Digital Employee Plugin] Running digital employee', {
      employeeId,
      workflowId,
      async,
      childWorkflowId,
    });

    // ── 异步模式：触发后立即返回 ──
    if (async) {
      await client.workflow.start('runWorkflow', {
        args: [workflowId, mergedData, childWorkflowId],
        taskQueue: env.TEMPORAL_TASK_QUEUE,
        workflowId: childWorkflowId,
      });

      return {
        success: true,
        executionId: childWorkflowId,
        result: '数字员工工作流已异步启动。',
      };
    }

    // ── 同步模式：等待数字员工思考并完整返回对话结果 ──
    const executionResult = await client.workflow.execute('runWorkflow', {
      args: [workflowId, mergedData, childWorkflowId],
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId: childWorkflowId,
    });
    // console.log('executionResult', executionResult);

    // 稳妥提取工作流最终返回的文本回复
    const replyText = executionResult?.end?.result || executionResult?.result || executionResult;

    return {
      success: true,
      executionId: childWorkflowId,
      result: typeof replyText === 'object' ? JSON.stringify(replyText) : String(replyText || ''),
    };
  } catch (err) {
    ctx.logger.error(
      { err, employeeId },
      '[Digital Employee Plugin] Failed to execute digital employee workflow',
    );
    return {
      success: false,
      error: err.message || String(err),
    };
  }
}
