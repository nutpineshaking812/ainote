import WorkflowRepository from '../repositories/workflow.repository.js';
import WorkflowExecutionRepository from '../repositories/workflowExecution.repository.js';
import { ApiError } from '../utils/ApiError.js';
import registryService from './workflow/registry.service.js';
import { getTemporalClient } from '../temporal/client.js';
import UserRepository from '../repositories/user.repository.js'; // To manually populate
import OrganizationRepository from '../repositories/organization.repository.js'; // To manually populate
import OrganizationMemberRepository from '../repositories/organizationMember.repository.js';

import { validateTriggerNode, resolveTriggerType } from '../utils/workflowUtils.js';

async function createWorkflow(userId, organizationId, workflowData) {
  const triggerNodeType = validateTriggerNode(workflowData.nodes);
  const triggerType = resolveTriggerType(triggerNodeType);

  if (workflowData.scope && workflowData.scope !== 'APP') {
    throw ApiError.badRequest(
      'New workflows must be created with APP scope. Use Publish to promote to Organization.',
    );
  }

  return await WorkflowRepository.create({
    ...workflowData,
    id: undefined, // Let PostgreSQL generate UUID
    triggerType,
    scope: 'APP',
    organizationId: organizationId?.toString(),
    createdBy: userId?.toString(),
  });
}

async function createSystemOverride(userId, organizationId, workflowData) {
  const triggerNodeType = validateTriggerNode(workflowData.nodes);
  const triggerType = resolveTriggerType(triggerNodeType);

  if (workflowData.scope !== 'SYSTEM') {
    throw ApiError.badRequest('System overrides must maintain SYSTEM scope');
  }

  return await WorkflowRepository.create({
    ...workflowData,
    triggerType,
    scope: 'SYSTEM',
    organizationId: organizationId?.toString(),
    createdBy: userId?.toString(),
  });
}

async function getWorkflows(organizationId, filter = {}) {
  const { appId, includeSystem = false, limit, page, category, ...restFilter } = filter;

  const offset = page ? (parseInt(page) - 1) * (parseInt(limit) || 20) : 0;

  const workflows = await WorkflowRepository.findByOrganization(organizationId?.toString(), {
    appId: appId?.toString(),
    limit: parseInt(limit),
    offset,
    scope: includeSystem ? undefined : { $ne: 'SYSTEM' },
    category: category ? category : 'GENERAL',
    ...restFilter,
  });

  // Manually enrichment (User/Org)
  const allUserIds = [...new Set(workflows.map(wf => wf.createdBy?.toString()).filter(Boolean))];
  const users = allUserIds.length > 0 ? await UserRepository.findByIds(allUserIds) : [];
  const userMap = Object.fromEntries(users.map(u => [u.id, { id: u.id, username: u.username, email: u.email }]));

  const enrichedWorkflows = await Promise.all(
    workflows.map(async (wf) => {
      const result = { ...wf };
      if (wf.organizationId) {
        result.organizationId = await OrganizationRepository.findById(wf.organizationId);
      }
      if (wf.createdBy) {
        result.createdBy = userMap[wf.createdBy.toString()];
      }
      return result;
    }),
  );

  if (includeSystem) {
    const systemFlows = await registryService.getMergedWorkflows(organizationId, appId);
    const shallowSystemFlows = systemFlows.map((f) => {
      const { nodes, edges, ...rest } = f;
      return rest;
    });

    const dbWorkflowIds = enrichedWorkflows.map((w) => w.id?.toString() || w._id?.toString());
    let filteredSystemFlows = shallowSystemFlows.filter(
      (sf) => !dbWorkflowIds.includes(sf._id?.toString()),
    );

    if (filter.category) {
      filteredSystemFlows = filteredSystemFlows.filter((sf) => sf.category === filter.category);
    }

    return [...enrichedWorkflows, ...filteredSystemFlows];
  }

  return enrichedWorkflows;
}

async function getWorkflowById(organizationId, id, filter = {}) {
  if (typeof id === 'string' && id.startsWith('system_')) {
    const key = id.replace('system_', '');
    const workflow = await registryService.getWorkflowByKey(key, filter.appId);
    if (!workflow) throw ApiError.notFound('System workflow not found');
    return workflow;
  }

  const workflow = await WorkflowRepository.findById(id);

  if (!workflow) {
    throw ApiError.notFound('Workflow not found');
  }

  const isSystem = workflow.scope === 'SYSTEM';
  const isOwner = workflow.organizationId?.toString() === organizationId?.toString();

  if (!isSystem && !isOwner) {
    const allowCrossOrg = filter.allowCrossOrg === true;
    if (allowCrossOrg && filter.userId && workflow.organizationId) {
      const member = await OrganizationMemberRepository.findOne(
        filter.userId.toString(),
        workflow.organizationId.toString(),
      );
      if (!member) {
        throw ApiError.notFound('Workflow not found');
      }
    } else {
      throw ApiError.notFound('Workflow not found');
    }
  }
  return workflow;
}

async function updateWorkflow(organizationId, id, updateData) {
  if (updateData.nodes) {
    const triggerNodeType = validateTriggerNode(updateData.nodes);
    updateData.triggerType = resolveTriggerType(triggerNodeType);
  }

  const existing = await WorkflowRepository.findById(id);
  if (!existing || existing.organizationId?.toString() !== organizationId?.toString()) {
    throw ApiError.notFound('Workflow not found');
  }

  if (updateData.scope === 'SYSTEM') {
    throw ApiError.forbidden('Cannot set SYSTEM scope via this interface.');
  }

  if (updateData.scope === 'ORGANIZATION' && existing.scope !== 'ORGANIZATION') {
    throw ApiError.badRequest('Please use the Publish interface to release to Organization.');
  }

  const workflow = await WorkflowRepository.update(id, organizationId?.toString(), updateData);

  if (workflow && workflow.status === 'ACTIVE') {
    const pluginTriggerNode = (workflow.nodes || []).find((n) => n.type === 'plugin-trigger');
    if (pluginTriggerNode && pluginTriggerNode.data?.pluginId) {
      import('./plugin.service.js').then((m) => {
        m.default.reloadPlugin(pluginTriggerNode.data.pluginId);
      });
    }
  }

  return workflow;
}

async function deleteWorkflow(organizationId, id) {
  const workflow = await WorkflowRepository.delete(id, organizationId?.toString());
  if (!workflow) {
    throw ApiError.notFound('Workflow not found');
  }
  return workflow;
}

async function getWorkflowExecutions(organizationId, workflowId, pagination = {}) {
  const { page = 1, limit = 20 } = pagination;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  await getWorkflowById(organizationId, workflowId);

  const { executions, total } = await WorkflowExecutionRepository.find(
    { workflowId },
    { limit: parseInt(limit), offset },
  );

  const allUserIds = [...new Set(executions.map(ex => ex.triggeredBy?.toString()).filter(Boolean))];
  const users = allUserIds.length > 0 ? await UserRepository.findByIds(allUserIds) : [];
  const userMap = Object.fromEntries(users.map(u => [u.id, { id: u.id, username: u.username, email: u.email }]));

  const enrichedExecutions = executions.map((ex) => {
    const result = { ...ex };
    if (ex.triggeredBy) {
      result.triggeredBy = userMap[ex.triggeredBy.toString()];
    }
    return result;
  });

  return { executions: enrichedExecutions, total, page: parseInt(page), limit: parseInt(limit) };
}

async function getExecutionById(organizationId, id) {
  const execution = await WorkflowExecutionRepository.findById(id);
  if (!execution) {
    throw ApiError.notFound('Execution not found');
  }
  return execution;
}

async function createExecution(data) {
  const execution = await WorkflowExecutionRepository.create(data);
  return execution;
}

async function toggleStatus(organizationId, id, status) {
  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    throw ApiError.badRequest('Invalid status. Must be ACTIVE or INACTIVE.');
  }

  const workflow = await WorkflowRepository.update(id, organizationId?.toString(), { status });

  if (!workflow) {
    throw ApiError.notFound('Workflow not found');
  }

  const pluginTriggerNode = (workflow.nodes || []).find((n) => n.type === 'plugin-trigger');
  if (pluginTriggerNode && pluginTriggerNode.data?.pluginId) {
    import('./plugin.service.js').then((m) => {
      m.default.reloadPlugin(pluginTriggerNode.data.pluginId);
    });
  }

  return workflow;
}

async function getAllExecutions(organizationId, query = {}) {
  const { page = 1, limit = 20, resourceId, resourceType, workflowId, status } = query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const filter = {};
  if (organizationId && !resourceId) filter.organizationId = organizationId.toString();
  if (resourceId) filter.resourceId = resourceId;
  if (resourceType) filter.resourceType = resourceType;
  if (workflowId) filter.workflowId = workflowId;
  if (status) filter.status = status;

  const { executions, total } = await WorkflowExecutionRepository.find(filter, {
    limit: parseInt(limit),
    offset,
  });

  const allUserIds = [...new Set(executions.map(ex => ex.triggeredBy?.toString()).filter(Boolean))];
  const users = allUserIds.length > 0 ? await UserRepository.findByIds(allUserIds) : [];
  const userMap = Object.fromEntries(users.map(u => [u.id, { id: u.id, username: u.username, email: u.email }]));

  const processedExecutions = await Promise.all(
    executions.map(async (ex) => {
      const obj = { ...ex };

      // Manual population for workflowId (from PG) and triggeredBy (from Mongo)
      if (ex.workflowId) {
        if (ex.workflowId.startsWith('system_')) {
          const key = ex.workflowId.replace('system_', '');
          const systemDef = await registryService.getWorkflowByKey(key, null);
          if (systemDef) {
            obj.workflowId = {
              _id: ex.workflowId,
              id: ex.workflowId,
              name: systemDef.name,
              triggerType: systemDef.triggerType,
              isSystem: true,
            };
          }
        } else {
          // It's a standard workflow
          const wf = await WorkflowRepository.findById(ex.workflowId);
          if (wf) {
            obj.workflowId = {
              _id: wf.id,
              id: wf.id,
              name: wf.name,
              triggerType: wf.triggerType,
            };
          }
        }
      }

      if (ex.triggeredBy) {
        obj.triggeredBy = userMap[ex.triggeredBy.toString()];
      }

      return obj;
    }),
  );

  return { executions: processedExecutions, total, page: parseInt(page), limit: parseInt(limit) };
}

async function cancelExecution(organizationId, executionId, options = {}) {
  const execution = await WorkflowExecutionRepository.findById(executionId);
  if (!execution) {
    throw ApiError.notFound('Execution not found');
  }

  if (!options.skipAuth && execution.organizationId?.toString() !== organizationId?.toString()) {
    throw ApiError.forbidden('You do not have permission to cancel this execution.');
  }

  if (execution.status !== 'RUNNING') {
    throw ApiError.badRequest(
      `Execution is currently ${execution.status} and cannot be cancelled.`,
    );
  }

  if (!execution.temporalWorkflowId) {
    throw ApiError.badRequest(
      'This execution does not have a recorded Temporal ID and cannot be cancelled via API.',
    );
  }

  const client = await getTemporalClient();
  const handle = client.workflow.getHandle(execution.temporalWorkflowId, execution.temporalRunId);

  try {
    await handle.cancel();

    const updated = await WorkflowExecutionRepository.update(executionId, {
      status: 'CANCELLED',
      endTime: new Date(),
    });

    return updated;
  } catch (err) {
    if (err.name === 'WorkflowNotFoundError' || err.message?.includes('not found')) {
      throw ApiError.badRequest(
        'Workflow execution not found in Temporal (It might have already finished).',
      );
    }
    throw err;
  }
}

async function resetWorkflow(organizationId, id, filter = {}) {
  const { appId } = filter;
  let targetWorkflow = null;
  let workflowKey = null;

  // 1. Identify Target Workflow and Key
  if (typeof id === 'string' && id.startsWith('system_')) {
    workflowKey = id.replace('system_', '');
    const raw = await registryService.getRawSystemDefault(workflowKey);
    if (!raw) throw ApiError.notFound('Built-in definition not found');
    return { ...raw, id, _id: id, isSystem: true, isCustomized: false };
  } else {
    targetWorkflow = await WorkflowRepository.findById(id);
    if (!targetWorkflow || !targetWorkflow.workflowKey) {
      throw ApiError.notFound('Workflow not found or not a built-in workflow');
    }
    workflowKey = targetWorkflow.workflowKey;
  }

  // 2. Get real factory settings
  const def = await registryService.getRawSystemDefault(workflowKey);
  if (!def) throw ApiError.notFound('Built-in definition not found');

  // 3. Execute Overwrite
  const updated = await WorkflowRepository.update(
    targetWorkflow.id || targetWorkflow._id,
    organizationId,
    {
      nodes: def.nodes,
      edges: def.edges,
      status: def.status || 'ACTIVE',
    },
  );

  return { ...updated, isSystem: true, isCustomized: true };
}

export default {
  createWorkflow,
  createSystemOverride,
  getWorkflows,
  getWorkflowById,
  updateWorkflow,
  deleteWorkflow,
  getWorkflowExecutions,
  getExecutionById,
  createExecution,
  toggleStatus,
  getAllExecutions,
  cancelExecution,
  resetWorkflow,
};
