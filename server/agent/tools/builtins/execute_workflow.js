import { z } from 'zod';
import { getTemporalClient } from '../../../temporal/client.js';
import env from '../../../config/env.js';
import { logger } from '../../../config/logger.js';

import { TRIGGER_TYPES } from '../../../utils/workflowUtils.js';

/**
 * execute_workflow
 * Pure memory trial: No DB writes.
 */
export const executeWorkflow = {
  name: 'execute_workflow',
  description:
    '【工作流零垃圾试运行】：将编排好的 JSON 拓扑进行实时模拟执行。该工具不向数据库写入任何持久化记录，通过内存直接启动引擎并返回执行验证结果。建议在正式持久化前重复使用此工具。',
  inputSchema: z.object({
    name: z.string().describe('工作流展示名称'),
    workflowKey: z.string().describe('唯一标识符 (大写下划线格式)'),
    description: z.string().describe('工作流描述'),
    triggerType: z.string().describe('触发器类型，默认click'),
    cron: z.string().describe('定时任务表达式'),
    nodes: z
      .array(
        z.object({
          id: z.string(),
          type: z.string(),
          data: z.any(),
          position: z.any(),
        }),
      )
      .describe('节点列表'),
    edges: z
      .array(
        z.object({
          source: z.string(),
          target: z.string(),
          targetHandle: z.string().optional(),
        }),
      )
      .describe('连线列表'),
    args: z.record(z.string(), z.any()).optional().describe('试运行时传入的模拟初始变量'),
  }),
  execute: async (input, context) => {
    const { userId, orgId, sessionId } = context || {};

    // Helper to handle stringified core arrays
    const safeParse = (val) => {
      if (typeof val === 'string' && val.trim().startsWith('[')) {
        try {
          return JSON.parse(val);
        } catch (e) {
          return val;
        }
      }
      return val;
    };

    let { name, nodes, edges, workflowKey, args: testArgs = {} } = input || {};
    nodes = safeParse(nodes);
    edges = safeParse(edges);

    // 1. Root-level Validation
    if (!name || !nodes || !Array.isArray(nodes)) {
      logger.warn(
        { input },
        '[execute_workflow] Validation failed: missing or malformed root parameters',
      );
      return {
        success: false,
        error: '工作流参数缺失或格式错误（name 和 nodes 数组是必填项）。',
        suggestion: `【核心修正建议】：请确保你直接在工具的根参数中传递了所有字段，不要将数据包裹在任何嵌套对象中。试运行参数必须与保存参数格式一致。
注意：nodes 字段必须是一个数组。
正确示例：{ "name": "我的工作流", "nodes": [...], "edges": [...] }
请按此平铺结构重新调用 execute_workflow。`,
      };
    }

    logger.info({ sessionId, name, cron }, '[execute_workflow] Executing trial');

    // 2. Prepare Payload: Deep clone to avoid mutating input
    const payload = JSON.parse(
      JSON.stringify({
        name: name || 'UNTITLED_TRIAL',
        nodes,
        edges: edges || [],
        workflowKey: workflowKey || `trial_${Date.now()}`,
      }),
    );

    // Strip database IDs to force "Inline Execution"
    delete payload._id;
    delete payload.id;

    // Inject system context
    payload.organizationId = orgId;
    payload.createdBy = userId;
    if (context.appId) payload.appId = context.appId;

    // 3. Trigger Shift: Switch ANY entry trigger to 'click' for dry run
    const triggerIndex = payload.nodes.findIndex((n) => TRIGGER_TYPES.includes(n.type));
    if (triggerIndex !== -1) {
      payload.nodes[triggerIndex].type = 'click';
    }

    // 4. Pre-flight Strict Parameter Validation
    const triggerNode = payload.nodes.find((n) => TRIGGER_TYPES.includes(n.type));
    if (triggerNode && triggerNode.data && triggerNode.data.inputs) {
      const inputs = Array.isArray(triggerNode.data.inputs) ? triggerNode.data.inputs : [];
      const requiredFields = inputs
        .filter((i) => i.required === true && i.isSystem !== true)
        .map((i) => i.name);

      const missing = requiredFields.filter(
        (key) => !testArgs[key] && testArgs[key] !== 0 && testArgs[key] !== false,
      );

      if (missing.length > 0) {
        return {
          success: false,
          error: `缺失必填测试参数: [${missing.join(', ')}]`,
          errorCategory: 'MISSING_PARAMS',
          suggestion: `试运行工作流需要提供触发器要求的初始参数。请在 args 字段中补齐这些字段，例如：args: ${JSON.stringify(Object.fromEntries(missing.map((m) => [m, '...'])))}`,
        };
      }
    }

    // 5. Start Temporal execution
    const client = await getTemporalClient();
    const trialExecutionId = `trial-${Date.now()}`;

    try {
      const handle = await client.workflow.start('runWorkflow', {
        args: [payload, { ...testArgs, userId, orgId, sessionId }, trialExecutionId],
        taskQueue: env.TEMPORAL_TASK_QUEUE,
        workflowId: `trial-${workflowKey || 'anon'}-${Date.now()}`,
      });

      const result = await handle.result();
      return { success: true, isTrial: true, trialSession: trialExecutionId, result };
    } catch (err) {
      logger.error({ err }, '[execute_workflow] Trial failed');
      let errorMsg = err.message;
      let cur = err;
      while (cur.cause) {
        cur = cur.cause;
        if (cur.message) errorMsg = cur.message;
      }

      return {
        success: false,
        error: errorMsg,
        errorCategory: cur.type === 'VALIDATION_ERROR' ? 'SCHEMA_ERROR' : 'EXECUTION_ERROR',
        suggestion:
          '执行引擎报错。如果涉及到类型不匹配，请检查 nodes.md 中的字段定义。如果报错与某个具体节点有关，请通过 read_skill_resource 重新审计该节点的 input 参数要求。',
      };
    }
  },
};
