import fs from 'fs';
import fse from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import simpleGit from 'simple-git';
import crypto from 'crypto';
import WorkflowRepository from '../repositories/workflow.repository.js';
import { WorkflowExecutionRepository } from '../repositories/workflowExecution.repository.js';
import { getNonGlobalTools, executeBuiltinTool } from '../agent/tools/index.js';
import { getTemporalClient } from '../temporal/client.js';
import env from '../config/env.js';
import OrganizationMemberRepository from '../repositories/organizationMember.repository.js';
import OrganizationRepository from '../repositories/organization.repository.js';
import { logger } from '../config/logger.js';
import McpService from './mcp.service.js';
import McpServerRepository from '../repositories/mcpServer.repository.js';
import PackageSkillRepository from '../repositories/packageSkill.repository.js';
import TemplateRepository from '../repositories/template.repository.js';
import DocumentRepository from '../repositories/document.repository.js';
import { db } from '../db/index.js';
import { templates, orgCategories } from '../db/schema/index.js';
import { inArray, sql } from 'drizzle-orm';
import { blocksToMarkdown } from '../utils/contentProcessor.js';

/**
 * SkillService (Skill Hub)
 * Decouples the Skill Protocol (AI Interface) from the Implementation.
 */
class SkillService {
  /**
   * Hard-coded system-level skills.
   */
  getSystemSkills({ page = 1, limit } = {}) {
    const allSkills = getNonGlobalTools().map((t) => ({
      ...t,
      scope: 'SYSTEM',
    }));

    if (limit === undefined || limit === null) {
      return {
        list: allSkills,
        total: allSkills.length,
        page: 1,
        totalPages: 1,
      };
    }

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedSkills = allSkills.slice(startIndex, endIndex);

    return {
      list: paginatedSkills,
      total: allSkills.length,
      page,
      totalPages: Math.ceil(allSkills.length / limit),
    };
  }

  /**
   * Get filtered organization skills.
   */
  async getOrganizationSkills({ userId, orgId, page = 1, limit = 20 }) {
    if (!orgId) return { list: [], total: 0, page, totalPages: 0 };

    const workflowDocs = await WorkflowRepository.findByOrganization(orgId, {
      scope: 'ORGANIZATION',
    });

    const skills = workflowDocs.map((doc) => ({
      id: doc.id.toString(),
      name: doc.skillConfig?.name || doc.name,
      label: doc.skillConfig?.name || doc.name,
      description: doc.skillConfig?.description || doc.description,
      inputSchema: doc.skillConfig?.inputSchema || {},
      type: 'WORKFLOW',
      implementationRef: doc.id.toString(),
      workflowName: doc.name,
      appId: doc.appId,
      scope: doc.scope,
      isSkill: doc.isSkill,
      status: doc.status,
    }));

    const total = skills.length;
    const paginatedSkills = skills.slice((page - 1) * limit, page * limit);

    return {
      list: paginatedSkills,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get all skills available to a specific user context.
   */
  async getAvailableSkills({ userId, orgId, appId, scope, requestedIds }) {
    let allSkills = [];

    if (requestedIds && requestedIds.length > 0) {
      const flatIds = requestedIds.flat(Infinity).map((id) => String(id));
      const potentialDocIds = flatIds
        .filter((id) => id.startsWith('doc:'))
        .map((id) => id.replace(/^doc:/, ''));

      if (potentialDocIds.length > 0) {
        const [foundDocs, foundTemplates] = await Promise.all([
          DocumentRepository.findAll({
            where: (t, d) => d.inArray(t.id, potentialDocIds),
          }),
          db.select().from(templates).where(inArray(templates.id, potentialDocIds)),
        ]);

        const allEntities = [...foundDocs, ...foundTemplates];

        const docSkills = await Promise.all(
          allEntities.map(async (doc) => {
            const rawContent = doc.contentPlain || '';
            const title = doc.title || doc.name || `doc_${doc.id || doc._id}`;
            const { meta, content: parsedContent } = this._parseMetadataAndContent(rawContent);

            const isDocSkill = doc.purpose === 'SKILL';
            const skillName = isDocSkill && doc.skillName ? doc.skillName : meta.name || title;
            const skillDesc =
              isDocSkill && doc.description
                ? doc.description
                : meta.description ||
                  `SOP: ${title}. Use this as a specialized tool to process raw materials according to the rules in this document.`;
            const skillParams = isDocSkill ? doc.parameters || {} : meta.parameters || {};

            return {
              id: `doc:${doc.id || doc._id}`,
              name: skillName,
              label: isDocSkill && doc.skillName ? doc.skillName : meta.name || title,
              description: skillDesc,
              hideResult: !!meta.hideResult,
              inputSchema: skillParams,
              type: 'DOCUMENT',
              implementationRef: (doc.id || doc._id).toString(),
              scope: 'PRIVATE',
            };
          }),
        );
        allSkills = [...allSkills, ...docSkills];
      }

      const empIds = flatIds
        .filter((id) => id.startsWith('emp_'))
        .map((id) => id.replace(/^emp_/, ''));

      if (empIds.length > 0) {
        const { default: deService } = await import('./digitalEmployee.service.js');
        const empSkills = await Promise.all(
          empIds.map(async (empId) => {
            try {
              const emp = await deService.getEmployeeById(empId);
              if (!emp) return null;

              let cleanName = emp.name.replace(/[^a-zA-Z0-9_]/g, '');
              if (!cleanName) {
                cleanName = `employee_${empId.toString().slice(-4)}`;
              } else {
                cleanName = `${cleanName}_${empId.toString().slice(-4)}`;
              }
              const toolName = `delegate_to_${cleanName}`;

              return {
                id: `emp_${empId}`,
                name: toolName,
                label: `委托任务给【${emp.name}】(${emp.roleTitle || '协作者'})`,
                description: `咨询或向协同团队成员【${emp.name}】（职位/角色：${emp.roleTitle || '协作者'}）委派子任务。专长领域：${emp.description || '协助处理专业领域的任务。'}`,
                inputSchema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      description: `需要委派给【${emp.name}】的具体任务内容、上下文或需要向其咨询的问题。`,
                    },
                  },
                  required: ['message'],
                },
                type: 'DIGITAL_EMPLOYEE',
                implementationRef: empId,
                empName: emp.name,
                empRoleTitle: emp.roleTitle || '协作者',
                scope: 'PRIVATE',
                hideResult: false,
              };
            } catch (err) {
              logger.error({ err, empId }, 'Failed to load emp as skill');
              return null;
            }
          }),
        );
        allSkills = [...allSkills, ...empSkills.filter(Boolean)];
      }
    }

    if (!scope || scope === 'SYSTEM') {
      const systemSkills = this.getSystemSkills();
      allSkills = [...allSkills, ...systemSkills.list];
    }

    const workflowDocs = await WorkflowRepository.findAvailableSkills(orgId, appId, scope);

    if (workflowDocs.length > 0) {
      const dbSkills = workflowDocs.map((doc) => ({
        id: doc.id.toString(),
        name: doc.skillConfig?.name || doc.name,
        label: doc.skillConfig?.name || doc.name,
        description: doc.skillConfig?.description || doc.description,
        inputSchema: doc.skillConfig?.inputSchema || {},
        type: 'WORKFLOW',
        implementationRef: doc.id.toString(),
        scope: doc.scope,
        hideResult: false,
      }));
      allSkills = [...allSkills, ...dbSkills];
    }

    // Auto-discover document skills with "skill" tag or isSkill = true in the current appId
    if (appId) {
      const skillDocs = await DocumentRepository.findAll({
        where: (t, d) => d.and(d.eq(t.appRef, appId.toString()), d.eq(t.purpose, 'SKILL')),
      });

      if (skillDocs.length > 0) {
        const docSkills = await Promise.all(
          skillDocs.map(async (doc) => {
            const rawContent = doc.contentPlain || '';
            const title = doc.title || `doc_${doc.id}`;
            const { meta, content: parsedContent } = this._parseMetadataAndContent(rawContent);

            const isDocSkill = doc.purpose === 'SKILL';
            const skillName = isDocSkill && doc.skillName ? doc.skillName : meta.name || title;
            const skillDesc =
              isDocSkill && doc.description
                ? doc.description
                : meta.description ||
                  `SOP: ${title}. Use this as a specialized tool to process raw materials according to the rules in this document.`;
            const skillParams = isDocSkill ? doc.parameters || {} : meta.parameters || {};

            return {
              id: `doc:${doc.id}`,
              name: skillName,
              label: isDocSkill && doc.skillName ? doc.skillName : meta.name || title,
              description: skillDesc,
              hideResult: !!meta.hideResult,
              inputSchema: skillParams,
              type: 'DOCUMENT',
              implementationRef: doc.id.toString(),
              scope: 'PRIVATE',
            };
          }),
        );
        allSkills = [...allSkills, ...docSkills];
      }
    }

    const mcpServers = await McpServerRepository.findActive(orgId);

    for (const server of mcpServers) {
      const mcpSkills = (server.tools || []).map((tool) => ({
        id: `mcp:${server.id}:${tool.name}`,
        name: tool.name,
        label: `${server.label}: ${tool.name}`,
        description: tool.description,
        inputSchema: tool.inputSchema || {},
        type: 'MCP',
        implementationRef: `${server.id}:${tool.name}`,
        scope: 'ORGANIZATION',
        mcpServerId: server.id,
        mcpServerName: server.name,
        hideResult: false,
      }));
      allSkills = [...allSkills, ...mcpSkills];
    }

    const packageSkills = await this.getPackageSkills({ userId, orgId });
    allSkills = [...allSkills, ...packageSkills];

    return allSkills;
  }

  /**
   * getPackageSkills: Fetch all PACKAGE_SKILL type skills from the database registry.
   */
  async getPackageSkills({ userId, orgId } = {}) {
    const skillsDir = env.SKILLS_DIR;

    const finalSkills = await PackageSkillRepository.findAll(orgId);

    // In memory filter for status since we didn't add it to findAll yet or just keep it simple
    const activeSkills = finalSkills.filter((s) => s.status === 'ACTIVE');

    return activeSkills.map((s) => {
      const hasResources = !!s.hasResources;
      const explicitSchema =
        s.parameters && Object.keys(s.parameters).length > 0 ? s.parameters : null;

      return {
        id: `pkg:${s.folderName}`,
        name: s.name,
        label: s.name,
        description: s.description,
        type: 'PACKAGE_SKILL',
        implementationRef: path.join(skillsDir, s.folderName),
        scope: s.organizationId ? 'ORGANIZATION' : 'SYSTEM',
        requires: s.requires || {},
        inputSchema: explicitSchema,
        ownerId: s.ownerId,
        hideResult: !!s.hideResult,
        hasResources,
        sopContent: null,
      };
    });
  }

  /**
   * syncPackageSkills: Reconcile the local filesystem (SKILLS_DIR) with the database registry.
   */
  async syncPackageSkills(context = {}) {
    const { orgId, userId } = context;
    const skillsDir = env.SKILLS_DIR;
    const foundFolders = [];

    if (!fs.existsSync(skillsDir)) {
      logger.warn({ skillsDir }, '[syncPackageSkills] SKILLS_DIR does not exist');
      return { success: false, imported: 0, removed: 0 };
    }

    const scanDirectory = (baseDir, isTopLevel = true) => {
      let entries;
      try {
        entries = fs.readdirSync(baseDir, { withFileTypes: true });
      } catch (err) {
        return;
      }
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
        const entryPath = path.join(baseDir, entry.name);
        if (isTopLevel && entry.name === 'installed') continue;

        if (fs.existsSync(path.join(entryPath, 'SKILL.md'))) {
          foundFolders.push({ folderPath: entryPath, folderName: entry.name });
        }
      }
    };
    scanDirectory(skillsDir, true);

    const dbSkills = await PackageSkillRepository.findAll();
    const dbFoldersMap = new Map(dbSkills.map((s) => [s.folderName, s]));
    const existingFoldersMap = new Map(foundFolders.map((f) => [f.folderName, f]));

    const brokenIds = dbSkills
      .filter((s) => !existingFoldersMap.has(s.folderName))
      .map((s) => s.id);

    for (const brokenId of brokenIds) {
      await PackageSkillRepository.delete(brokenId);
    }

    let importCount = 0;
    let updateCount = 0;

    for (const folder of foundFolders) {
      try {
        const content = fs.readFileSync(path.join(folder.folderPath, 'SKILL.md'), 'utf-8');
        const parsed = matter(content);
        const meta = parsed.data;
        if (!meta.name || !meta.description) continue;

        const hasReferences = fs.existsSync(path.join(folder.folderPath, 'references'));
        const hasScripts = fs.existsSync(path.join(folder.folderPath, 'scripts'));

        const data = {
          folderName: folder.folderName,
          name: meta.name,
          description: meta.description,
          parameters: meta.parameters || {},
          requires: meta.requires || {},
          hideResult: !!meta.hideResult,
          hasResources: hasReferences || hasScripts,
          status: 'ACTIVE',
          organizationId: orgId || null,
          ownerId: userId || null,
        };

        if (dbFoldersMap.has(folder.folderName)) {
          await PackageSkillRepository.upsert(data);
          updateCount++;
        } else {
          await PackageSkillRepository.create(data);
          importCount++;
        }
      } catch (e) {
        logger.error({ folder: folder.folderName, err: e }, 'Failed to parse SKILL.md during sync');
      }
    }

    return {
      success: true,
      imported: importCount,
      updated: updateCount,
      removed: brokenIds.length,
    };
  }

  loadSkillSop(skillFolder) {
    const skillMdPath = path.join(skillFolder, 'SKILL.md');
    const content = fs.readFileSync(skillMdPath, 'utf-8');
    const { content: sopBody } = matter(content);
    return sopBody.trim();
  }

  parseSkillMd(skillMdPath) {
    const content = fs.readFileSync(skillMdPath, 'utf-8');
    const { data, content: sopBody } = matter(content);
    return { metadata: data, sopContent: sopBody.trim() };
  }

  /**
   * Load the plain-text SOP content of a DOCUMENT skill.
   * Returns null if the document cannot be found.
   */
  // async loadDocumentSopContent(implementationRef) {
  //   try {
  //     let doc = await DocumentRepository.findById(implementationRef);
  //     if (!doc) doc = await TemplateRepository.findById(implementationRef);
  //     if (!doc) return null;
  //     const rawContent = doc.contentPlain || '';
  //     const { content: sopContent } = this._parseMetadataAndContent(rawContent);
  //     return sopContent || null;
  //   } catch (e) {
  //     logger.warn({ e, implementationRef }, '[SkillService] loadDocumentSopContent failed');
  //     return null;
  //   }
  // }

  async execute(skillNameOrObj, args, context) {
    const { userId, orgId, appId } = context;

    let skillDef;
    if (typeof skillNameOrObj === 'object') {
      skillDef = skillNameOrObj;
    } else {
      const skills = await this.getAvailableSkills(context);
      skillDef = skills.find((s) => s.name === skillNameOrObj || s.id === skillNameOrObj);
    }

    if (!skillDef) {
      throw new Error(
        `Skill definition not found: ${typeof skillNameOrObj === 'object' ? skillNameOrObj.name : skillNameOrObj}`,
      );
    }

    logger.info(
      { skillId: skillDef.id, skillType: skillDef.type, args },
      `[SkillService] Executing skill: ${skillDef.id} (${skillDef.name})`,
    );

    switch (skillDef.type) {
      case 'CODE':
        return await this._executeCodeSkill(skillDef.implementationRef, args, context);
      case 'WORKFLOW':
        return await this._executeWorkflowSkill(skillDef.implementationRef, args, context);
      case 'DIGITAL_EMPLOYEE':
        return await this._executeDigitalEmployeeSkill(skillDef, args, context);
      case 'DOCUMENT':
        return await this._executeDocumentSkill(skillDef.implementationRef, args, context);
      case 'API':
        return await this._executeApiSkill(skillDef.implementationRef, args, context);
      case 'MCP':
        return await this._executeMcpSkill(skillDef.implementationRef, args, context);
      case 'PACKAGE_SKILL':
        return await this._executePackageSkill(skillDef, args, context);
      default:
        return undefined;
    }
  }

  async _executeCodeSkill(toolName, args, context) {
    return await executeBuiltinTool(toolName, args, context);
  }

  async _executeWorkflowSkill(workflowId, args, context) {
    const { userId, orgId } = context;
    const workflow = await WorkflowRepository.findById(workflowId);
    if (!workflow) throw new Error('Workflow implementation not found');

    const client = await getTemporalClient();
    const wfIdStr = workflow.id.toString();

    const execution = await WorkflowExecutionRepository.create({
      workflowId: wfIdStr,
      organizationId: workflow.organizationId || orgId,
      triggeredBy: userId?.toString(),
      triggerData: {
        ...args,
        triggeredBy: userId,
        triggerType: 'MANUAL',
        triggeredAt: new Date(),
      },
    });

    const executionId = execution.id.toString();

    const handle = await client.workflow.start('runWorkflow', {
      args: [{ id: wfIdStr }, execution.triggerData, executionId],
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId: `skill-run-${wfIdStr}-${Date.now()}`,
    });

    return await handle.result();
  }

  async _executeDigitalEmployeeSkill(skillDef, args, context) {
    const { userId, orgId, appId, executionId, sessionId, parentExecutionId } = context;
    const employeeId = skillDef.implementationRef;
    const message = args.message || args.query;

    const { default: deService } = await import('./digitalEmployee.service.js');
    const { getTemporalClient } = await import('../temporal/client.js');

    const execTriggerData = {
      userId,
      orgId,
      appId,
      triggeredBy: userId,
      message,
      query: message,
      employeeId,
      parentEmployeeId: skillDef.parentEmployeeId,
      parentExecutionId: parentExecutionId || executionId,
      sessionId,
    };

    const { workflowId: brainWorkflowId, mergedData } = await deService.getExecutionConfig(
      employeeId,
      execTriggerData,
    );

    const client = await getTemporalClient();

    let empInfo = employeeId.toString().slice(-4);
    try {
      const emp = await deService.getEmployeeById(employeeId);
      if (emp) {
        const safeName = emp.name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '');
        const safeRole = (emp.roleTitle || '员工').replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '');
        empInfo = safeRole ? `${safeName}_${safeRole}` : safeName;
      }
    } catch (e) {}

    const parentPrefix = executionId ? `e_${executionId.substring(0, 8)}` : 'e_ext';
    const uniqueSuffix = crypto.randomUUID().substring(0, 8);
    const childWorkflowId = `${parentPrefix}:de_${empInfo}:${uniqueSuffix}`;

    const childMergedData = { ...mergedData, parentExecutionId: parentExecutionId || executionId };

    const childWFResult = await client.workflow.execute('runWorkflow', {
      args: [brainWorkflowId, childMergedData, childWorkflowId],
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId: childWorkflowId,
    });

    const output =
      childWFResult?.end?.result?.result ||
      childWFResult?.content ||
      childWFResult?.result ||
      childWFResult;

    return output;
  }

  async _executeDocumentSkill(implementationRef, args, context) {
    try {
      let doc = await DocumentRepository.findById(implementationRef);
      if (!doc) doc = await TemplateRepository.findById(implementationRef);

      if (!doc) throw new Error(`Document or Template not found: ${implementationRef}`);

      const rawContent = doc.contentPlain || '';
      const { meta, content: sopContent } = this._parseMetadataAndContent(rawContent);

      if (!sopContent.trim()) {
        return {
          success: true,
          data: `[Warning] Document "${doc.title || doc.name}" has no SOP content.`,
        };
      }

      // Extract mentioned docIds from BlockNote blocks (structured reference extraction)
      const mentionedDocIds = this._extractMentionedDocIds(doc.blocks);
      const subSkillIds = [];

      if (mentionedDocIds.length > 0) {
        const [foundDocs, foundTemplates] = await Promise.all([
          DocumentRepository.findAll({
            where: (t, d) => d.inArray(t.id, mentionedDocIds),
          }),
          db.select().from(templates).where(inArray(templates.id, mentionedDocIds)),
        ]);

        const allEntities = [...foundDocs, ...foundTemplates];

        for (const entity of allEntities) {
          if (entity.purpose === 'SKILL') {
            subSkillIds.push(`doc:${entity.id || entity._id}`);
          }
        }
      }

      const isDocSkill = doc.purpose === 'SKILL';
      const skillName =
        isDocSkill && doc.skillName ? doc.skillName : meta.name || doc.title || doc.name;
      const skillDesc =
        isDocSkill && doc.description
          ? doc.description
          : meta.description || doc.title || doc.name;

      const skillDef = {
        id: `doc:${implementationRef}`,
        name: skillName,
        description: skillDesc,
        type: 'DOCUMENT',
        implementationRef: implementationRef,
        requires: {
          tools: subSkillIds,
        },
      };

      const { default: SkillAgentInstance } = await import('../agent/SkillAgent.js');
      const result = await SkillAgentInstance.run({
        skillDef,
        sopContent,
        args,
        userId: context.userId,
        orgId: context.orgId,
        appId: context.appId,
        onProgress: context.onProgress,
        parentToolCallId: context.parentToolCallId,
        depth: (context.depth || 0) + 1,
        taskId: context.taskId || context.executionId,
        executionId: context.executionId,
        sessionId: context.sessionId,
        parentExecutionId: context.parentExecutionId || context.executionId,
        llmConfig: context.llmConfig || {},
        masterSystemPrompt: context.masterSystemPrompt || '',
        rootQuestion: context.rootQuestion || '',
      });

      if (meta.hideResult) {
        return '[Processing completed. Detailed output has been streamed directly to the user.]';
      }

      return result;
    } catch (err) {
      logger.error({ err, implementationRef }, 'Failed to execute Document skill');
      throw err;
    }
  }

  async _executeApiSkill(config, args, context) {
    throw new Error('API skill execution not yet implemented');
  }

  async _executeMcpSkill(implementationRef, args, context) {
    const [serverId, toolName] = implementationRef.split(':');
    return await McpService.callTool(serverId, toolName, args);
  }

  async _executePackageSkill(skillDef, args, context) {
    const { default: SkillAgent } = await import('../agent/SkillAgent.js');
    const sopContent = this.loadSkillSop(skillDef.implementationRef);

    const result = await SkillAgent.run({
      skillDef,
      sopContent,
      args,
      masterSystemPrompt: context.masterSystemPrompt || '',
      rootQuestion: context.rootQuestion || '',
      depth: (context.depth || 0) + 1,
      llmConfig: context.llmConfig || {},
      userId: context.userId,
      orgId: context.orgId,
      appId: context.appId,
      onProgress: context.onProgress,
      parentToolCallId: context.parentToolCallId,
      taskId: context.taskId || context.executionId,
      executionId: context.executionId,
      sessionId: context.sessionId,
      parentExecutionId: context.parentExecutionId || context.executionId,
    });

    if (skillDef.hideResult) {
      return '[Task completed successfully. Output has been streamed to the user.]';
    }

    return result;
  }

  async publishWorkflowAsSkill(workflowId, skillConfig, { userId, orgId, appId }) {
    const workflow = await WorkflowRepository.findById(workflowId);
    if (!workflow) throw new Error('Workflow not found');

    let { name, description, inputSchema, outputSchema, scope, isSkill } = skillConfig;
    const targetName = name || workflow.skillConfig?.name || workflow.name;
    const effectiveScope = scope || workflow.scope || 'APP';

    if (isSkill !== false) {
      const allAvailable = await this.getAvailableSkills({
        userId,
        orgId,
        appId,
        scope: effectiveScope,
      });
      const wfIdStr = workflow.id.toString();

      const isTaken = allAvailable.some(
        (s) =>
          s.name === targetName &&
          s.id !== wfIdStr &&
          s.id !== `system:${targetName}` &&
          s.id !== `pkg:${targetName}`,
      );

      if (isTaken) {
        throw new Error(
          `Skill name "${targetName}" is already taken. Please choose a unique name.`,
        );
      }
    }

    return await WorkflowRepository.update(workflowId, orgId, {
      isSkill: isSkill !== undefined ? isSkill : true,
      scope: effectiveScope,
      skillConfig: {
        ...(workflow.skillConfig || {}),
        description: description || workflow.skillConfig?.description || workflow.description,
        inputSchema: inputSchema || workflow.skillConfig?.inputSchema || {},
        outputSchema: outputSchema || workflow.skillConfig?.outputSchema || {},
        name: name || targetName,
      },
    });
  }

  async detachSkill(workflowId, { userId, orgId }) {
    const workflow = await WorkflowRepository.findById(workflowId);
    if (!workflow) throw new Error('Workflow not found');
    const update = { scope: workflow.appId ? 'APP' : 'ORGANIZATION' };
    return await WorkflowRepository.update(workflowId, orgId, update);
  }

  async unlinkApp(workflowId, { userId, orgId }) {
    const workflow = await WorkflowRepository.findById(workflowId);
    if (!workflow) throw new Error('Workflow not found');
    return await WorkflowRepository.update(workflowId, orgId, { appId: null });
  }

  async installFromGit(gitUrl) {
    const tmpDir = path.join(process.cwd(), 'tmp', `install-${Date.now()}`);
    try {
      await fse.ensureDir(tmpDir);
      const git = simpleGit();
      await git.clone(gitUrl, tmpDir, ['--depth', '1']);
      const repoHash = crypto.createHash('md5').update(gitUrl).digest('hex').substring(0, 8);
      const repoNameBase = path.basename(gitUrl).replace('.git', '');
      const repoFolderName = `${repoNameBase}_${repoHash}`;
      const installedBaseDir = path.join(env.SKILLS_DIR, 'installed', repoFolderName);
      await fse.ensureDir(installedBaseDir);
      await fse.copy(tmpDir, installedBaseDir);
      await fse.remove(path.join(installedBaseDir, '.git'));
      const allSkills = await this.getPackageSkills();
      const newSkills = allSkills.filter((s) => s.implementationRef.startsWith(installedBaseDir));
      return {
        success: true,
        repoFolderName,
        skillsCount: newSkills.length,
        skills: newSkills.map((s) => ({ id: s.id, name: s.name, label: s.label })),
      };
    } catch (err) {
      logger.error({ err, gitUrl }, '[SkillService] Git install failed');
      throw new Error(`Failed to install skill: ${err.message}`);
    } finally {
      await fse.remove(tmpDir).catch((e) => logger.warn({ e }, 'Failed to cleanup tmp dir'));
    }
  }

  async uninstallSkill(repoFolderName) {
    const targetDir = path.join(env.SKILLS_DIR, 'installed', repoFolderName);
    if (!fs.existsSync(targetDir)) throw new Error(`Skill repository not found: ${repoFolderName}`);
    try {
      await fse.remove(targetDir);
      return { success: true, message: `Repository ${repoFolderName} uninstalled successfully` };
    } catch (err) {
      logger.error({ err, repoFolderName }, '[SkillService] Uninstall failed');
      throw new Error(`Failed to uninstall skill: ${err.message}`);
    }
  }

  async discoverDocumentSkills({ userId, tags, teamId, currentOrg }) {
    if (!currentOrg) return [];
    let targetOrgIds = [];
    if (currentOrg.type === 'PERSONAL') {
      const memberships = await OrganizationMemberRepository.findByUserId(userId);
      targetOrgIds = memberships.filter((m) => m.status === 'ACTIVE').map((m) => m.organizationId);
    } else {
      targetOrgIds = [currentOrg.id.toString()];
    }
    if (targetOrgIds.length === 0) return [];
    const workflowDocs = await WorkflowRepository.findAvailableByOrgAndTags(
      targetOrgIds,
      'CAPABILITY',
      tags || [],
    );

    const orgIds = [...new Set(workflowDocs.map((doc) => doc.organizationId).filter(Boolean))];
    const orgs = orgIds.length > 0 ? await OrganizationRepository.findAll(orgIds) : [];
    const orgMap = Object.fromEntries(orgs.map((org) => [org.id.toString(), org.name]));

    // 批量拉取相关组织下的所有 categories，构建以 (orgId + "_" + key) 为键的配置映射
    const categories =
      targetOrgIds.length > 0
        ? await db
            .select()
            .from(orgCategories)
            .where(inArray(orgCategories.organizationId, targetOrgIds))
        : [];
    const categoryMap = new Map();
    categories.forEach((c) => {
      categoryMap.set(`${c.organizationId}_${c.key}`, {
        label: c.label,
        color: c.color,
        icon: c.icon,
      });
    });

    return workflowDocs.map((doc) => ({
      id: doc.id.toString(),
      name: doc.skillConfig?.name || doc.name,
      description: doc.skillConfig?.description || doc.description,
      sourceTeam: doc.organizationId
        ? orgMap[doc.organizationId.toString()] || 'Organization Workspace'
        : 'Organization Workspace',
      teamId: doc.organizationId,
      matchTags: (doc.triggerConfig?.matchTags || []).map((tagKey) => {
        const orgId = doc.organizationId?.toString();
        const category = categoryMap.get(`${orgId}_${tagKey}`);
        return {
          key: tagKey,
          label: category?.label || tagKey,
          color: category?.color || null,
          icon: category?.icon || null,
        };
      }),
      showStream: doc.triggerConfig?.showStream || false,
    }));
  }

  async savePackageSkill(folderName, data) {
    return await PackageSkillRepository.upsert({ folderName, ...data });
  }

  async deletePackageSkill(folderName) {
    return await PackageSkillRepository.deleteByFolderName(folderName);
  }

  _parseMetadataAndContent(rawContent) {
    try {
      const { data, content } = matter(rawContent);
      return { meta: data || {}, content: content || '' };
    } catch (e) {
      return { meta: {}, content: rawContent };
    }
  }

  _extractMentionedDocIds(blocks) {
    const docIds = new Set();
    const docLinkRegex =
      /\/document\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/;

    const scan = (val) => {
      if (!val) return;
      if (typeof val === 'string') {
        const match = val.match(docLinkRegex);
        if (match && match[1]) {
          docIds.add(match[1]);
        }
      } else if (Array.isArray(val)) {
        for (const item of val) {
          scan(item);
        }
      } else if (typeof val === 'object') {
        if (val.type === 'docMention' && val.props && val.props.docId) {
          docIds.add(String(val.props.docId));
        }
        for (const k in val) {
          if (Object.prototype.hasOwnProperty.call(val, k)) {
            scan(val[k]);
          }
        }
      }
    };

    scan(blocks);
    return Array.from(docIds);
  }
}

export default new SkillService();
