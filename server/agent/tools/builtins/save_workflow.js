import { z } from 'zod';
import WorkflowRepository from '../../../repositories/workflow.repository.js';
import { logger } from '../../../config/logger.js';
import { resolveTriggerType, TRIGGER_TYPES } from '../../../utils/workflowUtils.js';

/**
 * save_workflow
 * Formally persists a workflow to the database and activates it.
 */
export const saveWorkflow = {
  name: 'save_workflow',
  description: '保存Workflow',
  inputSchema: z.object({
    name: z.string().describe('工作流展示名称'),
    workflowKey: z.string().describe('唯一标识符 (大写下划线格式)'),
    description: z.string().describe('工作流描述'),
    triggerType: z.enum(['MANUAL', 'SCHEDULE']).describe('触发器类型：MANUAL (点击触发),'),
    cron: z.string().describe('必填。定时任务表达式。例如: 4 1 * * *'),
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
  }),
  execute: async (input, context) => {
    const { userId, orgId, sessionId } = context || {};
    // Helper to handle stringified core arrays often sent by LLMs
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

    let { name, workflowKey, nodes, edges, description, cron, triggerType } = input || {};
    nodes = safeParse(nodes);
    edges = safeParse(edges);

    // 1. Root-level Validation (Directly check for what we NEED)
    if (!name || !nodes || !Array.isArray(nodes)) {
      logger.warn(
        { input },
        '[save_workflow] Validation failed: missing or malformed root parameters',
      );
      return {
        success: false,
        error: '工作流参数缺失或格式错误（name 和 nodes 数组是必填项）。',
        suggestion: `【核心修正建议】：请确保你直接在工具的根参数中传递了所有字段，不要将数据包裹在任何嵌套对象中。
注意：nodes 字段必须是一个数组，请确保不要将其错误地嵌套在其它 key 之下。
正确示例：{ "name": "我的工作流", "nodes": [...], "edges": [...] }
请按此平铺结构重新调用 save_workflow。`,
      };
    }

    logger.info({ sessionId, name, cron }, '[save_workflow] Executing save');

    // 2. Resolve trigger logic
    const triggerNode = nodes.find((n) => TRIGGER_TYPES.includes(n.type));
    if (!triggerNode) {
      return {
        success: false,
        error: '未找到有效的触发器节点。',
        suggestion:
          "一个有效的工作流必须包含 'click' 或 'schedule' 等触发器节点作为起点，请核实你的拓扑结构。",
      };
    }

    const effectiveTriggerType = triggerType || resolveTriggerType(triggerNode.type);

    // Sync cron to trigger node data
    if (effectiveTriggerType === 'SCHEDULE' && cron) {
      triggerNode.data = { ...(triggerNode.data || {}), cron };
    }

    const effectiveCron = cron;

    // 3. Prepare Workflow Document
    const updateDoc = {
      name,
      workflowKey: workflowKey || `WF_${Date.now()}`,
      description: description || '',
      nodes,
      edges: edges || [],
      triggerType: effectiveTriggerType,
      triggerConfig: triggerNode.data || {},
      appId: context.appId,
      organizationId: orgId,
      createdBy: userId,
      isSkill: false,
      category: 'AUTOMATION',
      status: 'ACTIVE',
      updatedAt: new Date(),
    };

    try {
      // Find existing by key and appId
      let workflow = await WorkflowRepository.findOneByWorkflowKey(
        updateDoc.workflowKey,
        updateDoc.appId,
      );

      const shouldUpdate = workflow && workflow.organizationId === orgId;

      if (shouldUpdate) {
        workflow = await WorkflowRepository.update(workflow.id, orgId, updateDoc);
        logger.info({ workflowId: workflow?.id }, '[save_workflow] Updated existing workflow');
      } else {
        workflow = await WorkflowRepository.create(updateDoc);
        logger.info({ workflowId: workflow?.id }, '[save_workflow] Created new shadowed workflow');
      }

      // 4. Create Session Binding
      if (sessionId && workflow.id) {
        const { default: GatewayWorkflowBindingRepository } =
          await import('../../../repositories/gatewayWorkflowBinding.repository.js');
        const { default: WorkflowScheduler } =
          await import('../../../services/workflow.scheduler.js');

        const existingBindings = await GatewayWorkflowBindingRepository.findBySession(sessionId);
        const existingBinding = existingBindings.find(
          (b) => b.workflowId === workflow.id.toString(),
        );

        let bindingId;
        if (!existingBinding) {
          const newBinding = await GatewayWorkflowBindingRepository.create({
            workflowId: workflow.id.toString(),
            targetSessionId: sessionId,
            organizationId: orgId,
            cron: effectiveCron, // 存储到绑定表，作为调度的真理来源
            status: 'ENABLED',
          });
          bindingId = newBinding.id;
          logger.info(
            { workflowId: workflow.id, sessionId, bindingId },
            '[save_workflow] Created new session binding',
          );
        } else {
          bindingId = existingBinding.id;
          // 如果已存在绑定，但 cron 发生了变化，则更新绑定表中的调度
          await GatewayWorkflowBindingRepository.update(bindingId, orgId, {
            cron: effectiveCron,
          });
          logger.info(
            { workflowId: workflow.id, sessionId, bindingId },
            '[save_workflow] Updated existing session binding cron',
          );
        }

        // 5. Sync with Temporal Scheduler (Only for scheduled tasks)
        if (effectiveCron) {
          await WorkflowScheduler.syncBinding(bindingId);
          logger.info({ bindingId }, '[save_workflow] Temporal schedule sync triggered');
        } else {
          // If no longer a schedule, cleanup temporal
          await WorkflowScheduler.unscheduleBinding(bindingId);
        }
      }

      return {
        success: true,
        workflowId: workflow.id,
        message: `工作流 "${name}" 已成功保存。`,
      };
    } catch (err) {
      logger.error({ err, workflowKey: updateDoc.workflowKey }, '[save_workflow] Persist failed');
      return { success: false, error: err.message || '保存失败，请检查数据库连接或参数完整性。' };
    }
  },
};
