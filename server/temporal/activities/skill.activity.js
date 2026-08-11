import skillService from '../../services/skill.service.js';
import { logger } from '../../config/logger.js';
import { emitActivityEvent } from './system.activity.js';
import trace from '../../agent/utils/trace_logger.js';

/**
 * Workflow activity to manage AI skills (install/uninstall/etc.)
 */
export const handleSkillAction = async (data, nodeId, workflowId) => {
  const { action, gitUrl, repoFolderName } = data;

  logger.info(
    { action, gitUrl, repoFolderName, nodeId, workflowId },
    'Executing skill action activity',
  );

  try {
    switch (action) {
      case 'install':
        if (!gitUrl) throw new Error('gitUrl is required for install action');
        const installResult = await skillService.installFromGit(gitUrl);
        return {
          success: true,
          action: 'install',
          result: installResult,
        };

      case 'uninstall':
        if (!repoFolderName) throw new Error('repoFolderName is required for uninstall action');
        const uninstallResult = await skillService.uninstallSkill(repoFolderName);
        return {
          success: true,
          action: 'uninstall',
          result: uninstallResult,
        };

      case 'list':
        const skills = await skillService.getPackageSkills();
        return {
          success: true,
          action: 'list',
          count: skills.length,
          skills: skills.map((s) => ({ id: s.id, name: s.name, isRemovable: s.isRemovable })),
        };

      case 'saveSystem':
      case 'createSystem':
      case 'updateSystem':
        if (!data.folderName) throw new Error(`folderName is required for ${action} action`);
        const saveResult = await skillService.savePackageSkill(data.folderName, data);
        return { success: true, action: 'saveSystem', result: saveResult };

      case 'deleteSystem':
        if (!data.folderName) throw new Error('folderName is required for deleteSystem action');
        const deleteResult = await skillService.deletePackageSkill(data.folderName);
        return { success: true, action: 'deleteSystem', result: deleteResult };

      default:
        throw new Error(`Unsupported skill action: ${action}`);
    }
  } catch (err) {
    logger.error({ err, action, nodeId, workflowId }, 'Skill action activity failed');
    throw err;
  }
};

/**
 * Activity to execute a specific skill tool.
 * This is used by the Workflow Orchestrator to run tools one by one.
 */
export const executeSkillTool = async (data, nodeId, workflowId) => {
  const {
    skillId,
    skillName,
    args,
    userId,
    orgId,
    appId,
    executionId,
    sessionId,
    parentToolCallId, // The ID of the tool call that triggered this activity
    enhancedPrompt,
    userPrompt,
    model: modelProvider,
  } = data;

  // logger.info(
  //   { skillName, skillId, nodeId, workflowId, parentToolCallId },
  //   '[Activity] Executing skill tool',
  // );

  const { getGlobalTools } = await import('../../agent/tools/index.js');
  // Load the actual skill definition to check if it exists
  const allSkills = await skillService.getAvailableSkills({
    userId,
    orgId,
    appId,
    requestedIds: [skillId],
  });

  const combinedSkills = [...allSkills, ...getGlobalTools()];

  const skill = combinedSkills.find(
    (s) =>
      String(s.id || s._id) === String(skillId) ||
      s.name === skillName ||
      s.id === `system:${skillName}` ||
      s.id === `builtin:${skillName}`,
  );

  if (!skill) {
    throw new Error(
      `Tool "${skillName}" (ID: ${skillId}) not found or not available in this context. Requested for node ${nodeId} in workflow ${workflowId}`,
    );
  }

  trace.append(
    workflowId,
    'PARENT',
    `Dispatching Tool: ${skillName}, args: ${JSON.stringify(args)}`,
  );

  const result = await skillService.execute(skill, args, {
    userId,
    orgId,
    appId,
    parentToolCallId, // Root of this sub-agent's events
    taskId: workflowId,
    executionId,
    sessionId,
    masterSystemPrompt: enhancedPrompt,
    rootQuestion: userPrompt || '',
    llmConfig: { provider: modelProvider },
    onProgress: (p) => {
      // Bubble sub-agent progress events to the UI
      emitActivityEvent('node:progress', {
        workflowId,
        executionId,
        nodeId,
        ...p,
      });
    },
  });

  trace.result(workflowId, 'PARENT', skillName, result);
  return result;
};

/**
 * Activity to prepare configuration for a Digital Employee (Sub-Agent).
 * This runs fast and allows the Workflow to use native executeChild for the LLM execution.
 */
export const prepareDigitalEmployeeConfig = async ({ employeeId, triggerData, message }, nodeId, workflowId) => {
  logger.info({ employeeId, workflowId }, '[Activity] Preparing Digital Employee config');
  
  // 1. Set up the trigger data with the specific delegated message
  const execTriggerData = {
    ...triggerData,
    message,
    query: message,
    employeeId,
    parentEmployeeId: triggerData?.employeeId, // 调用方（父）数字员工 ID
  };

  // 2. Fetch the base configuration and merged prompt/knowledge from the DB
  const { default: deService } = await import('../../services/digitalEmployee.service.js');
  const { workflowId: brainWorkflowId, mergedData } = await deService.getExecutionConfig(employeeId, execTriggerData);

  return {
    brainWorkflowId,
    mergedData,
  };
};
