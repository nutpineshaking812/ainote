import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { SystemMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import AgentCore from './core/AgentCore.js';
import { openAITools } from './utils/tool_utils.js';
import { wrapSkillAsTool } from './tools/builtins/read_skill.js';
import { injectVariables } from './utils/prompt_templater.js';
import { logger } from '../config/logger.js';
import trace from './utils/trace_logger.js';
import { getToolDisplayMode } from './tools/index.js';

const MAX_SKILL_DEPTH = 15;

import { getSkillDiscoveryPrompt, formatSkillDiscoverySnippet } from './prompts/discovery.js';

/**
 * SkillAgent
 * Specialized executor for PACKAGE_SKILL type skills.
 *
 * Responsibilities:
 * 1. Build System Message = masterSystemPrompt + SKILL.md SOP body
 * 2. Resolve requires.tools (system tools + nested PACKAGE_SKILLs)
 * 3. Inject sandbox file tools (list_resources, read_resource)
 * 4. Delegate to AgentCore for the actual LLM loop
 * 5. Enforce MAX_SKILL_DEPTH to prevent runaway recursion
 */
class SkillAgent {
  /**
   * Run a Package Skill as a sub-agent.
   *
   * @param {object} options
   * @param {object} options.skillDef          - The skill definition from SkillService registry
   * @param {string} options.sopContent        - The SKILL.md body (SOP instructions)
   * @param {object} options.args              - Arguments passed from the parent agent
   * @param {string} options.masterSystemPrompt - The parent (main) agent's system prompt
   * @param {string} options.rootQuestion      - The original user question from the top-level agent
   * @param {number} options.depth             - Current recursion depth (starts at 1)
   * @param {object} options.llmConfig         - LLM provider configuration
   * @param {string} options.userId
   * @param {string} options.orgId
   * @param {string} options.appId
   * @param {Function} options.onProgress
   */
  async run({
    skillDef,
    sopContent,
    args = {},
    masterSystemPrompt = '',
    rootQuestion = '',
    depth = 1,
    llmConfig = {},
    userId,
    orgId,
    appId,
    taskId,
    executionId,
    sessionId,
    parentExecutionId,
    parentToolCallId = null, // The ID of the tool call that triggered this sub-agent
    onProgress = null,
  }) {
    if (depth > MAX_SKILL_DEPTH) {
      const msg = `[SkillAgent][D${depth}] Max recursion depth (${MAX_SKILL_DEPTH}) exceeded for skill "${skillDef.name}"`;
      logger.error({ skillName: skillDef.name, depth }, msg);
      throw new Error(msg);
    }

    const depthPrefix = `[SkillAgent][D${depth}]`;
    logger.info(
      { skillName: skillDef.name, depth, args },
      `${depthPrefix} Starting Package Skill execution: ${skillDef.name}`,
    );

    // 1. On-demand tool discovery: scan SOP content for [SKILL_REF] annotations
    //    复用 resolveAndPartitionSkills 的按需加载逻辑，把扫描源从"对话消息"换成"SOP 全文"
    if (sopContent) {
      try {
        const { resolveAndPartitionSkills } = await import('../temporal/activities/ai.activity.js');
        const { userSelectedSkills: sopDiscoveredSkills } = await resolveAndPartitionSkills({
          userId,
          orgId,
          appId,
          prompt: sopContent,
          skillIds: skillDef.requires?.tools || [],
        });
        const existingToolIds = new Set(skillDef.requires?.tools || []);
        sopDiscoveredSkills.forEach((s) => {
          if (s.id && !existingToolIds.has(s.id)) existingToolIds.add(s.id);
          if (s.name && !existingToolIds.has(s.name)) existingToolIds.add(s.name);
        });
        skillDef = {
          ...skillDef,
          requires: { ...skillDef.requires, tools: [...existingToolIds] },
        };
      } catch (e) {
        logger.warn({ e }, '[SkillAgent] SOP tool scanning failed, continuing without extra tools');
      }
    }

    // 2. Resolve tools declared in requires.tools first
    const { tools: resolvedTools, xmlPrompts: skillXmlPrompts } = await this._resolveTools(
      skillDef,
      {
        skillDef,
        masterSystemPrompt,
        rootQuestion,
        depth,
        llmConfig,
        userId,
        orgId,
        appId,
        taskId,
        executionId,
        sessionId,
        parentExecutionId,
        onProgress,
      },
    );

    // 2. Build System Message:
    //    masterSystemPrompt (global rules) + SKILL.md body (domain SOP, higher authority)
    //    Pre-process SOP with variable injection.
    const templatedSop = injectVariables(sopContent, args);

    // Create mapping of tools for document/sub-skills to guide the LLM
    const docTools = resolvedTools.filter((t) => t.name && (t.id || t._id));
    const { getToolMappingPrompt, getSubAgentHumanPrompt } = await import('./prompts/discovery.js');
    const toolMappingPrompt = getToolMappingPrompt(docTools);

    const systemContent = [
      masterSystemPrompt,
      masterSystemPrompt ? '\n\n---\n' : '',
      templatedSop,
      toolMappingPrompt,
      skillXmlPrompts ? `\n\n${skillXmlPrompts}` : '',
    ]
      .filter(Boolean)
      .join('');

    // 3. Build Human Message: original question + specific task args
    const humanContent = getSubAgentHumanPrompt(rootQuestion, args);

    const messages = [new SystemMessage(systemContent), new HumanMessage(humanContent)];

    logger.info(
      { skillName: skillDef.name, depth },
      `[SkillAgent][D${depth}] System Content:\n========================================\n${systemContent}\n========================================`
    );
    logger.info(
      { skillName: skillDef.name, depth },
      `[SkillAgent][D${depth}] Human Content:\n========================================\n${humanContent}\n========================================`
    );

    // 4. Build local sandbox tools if this is a Package Skill
    // These are PRIVATE and only visible within this SkillAgent session.
    let sandboxTools = [];
    if (skillDef.type === 'PACKAGE_SKILL' && skillDef.implementationRef) {
      sandboxTools = this._buildSandboxTools(skillDef.implementationRef);
    }

    // FINAL FILTER: Ensure technical tools like read_skill NEVER leak into the expert agent
    const filteredResolved = resolvedTools.filter(
      (t) => t.name !== 'read_skill' && t.name !== 'readSkill',
    );
    // 4.5. Inject global tools automatically
    const { getGlobalTools } = await import('./tools/index.js');
    const globalToolDefs = getGlobalTools();
    const filteredGlobals = globalToolDefs.filter(
      (t) => t.name !== 'read_skill' && t.name !== 'readSkill',
    );
    const globalToolsWrapped = filteredGlobals.map((tDef) =>
      wrapSkillAsTool(tDef, {
        masterSystemPrompt,
        rootQuestion,
        depth,
        llmConfig,
        userId,
        orgId,
        appId,
        parentToolCallId,
        onProgress,
      }),
    );

    // Filter global tools that are already overridden by sandbox versions
    const sandboxToolNames = new Set(sandboxTools.map((t) => t.name));
    const uniqueGlobalTools = globalToolsWrapped.filter((t) => !sandboxToolNames.has(t.name));

    const allTools = [...filteredResolved, ...uniqueGlobalTools, ...sandboxTools];

    console.log(
      '[SkillAgent] Final Toolset:',
      allTools.map((t) => t.name),
    );

    const traceId = llmConfig.taskId || appId || skillDef.id;
    trace.append(traceId, 'EXPERT', `[${skillDef.name}] Starting Sub-Agent session (d${depth})`);

    // Convert tools for AgentCore
    const openAIFormattedTools = openAITools(allTools);
    const executableTools = new Map(allTools.map((t) => [t.name, t]));

    // 5. Run via AgentCore
    const result = await AgentCore.run({
      messages,
      openAIFormattedTools,
      executableTools,
      sequentialTools: true, // 子工具串行执行，确保 SSE 事件顺序正确（避免并行导致的 UI 乱序）
      llmConfig: {
        ...llmConfig,
        userId,
        orgId,
        appId,
        taskId: taskId || executionId, // Root ID for Unified Tracing
        runName: `skill-${skillDef.name}-d${depth}`,
      },
      traceRole: 'EXPERT', // Role for TraceLogger
      onThinkingDelta: (content) => {
        if (onProgress) onProgress({ status: 'thinking-delta', content, depth, parentToolCallId });
      },
      onTextDelta: (content) => {
        if (onProgress) onProgress({ status: 'text-delta', content, depth, parentToolCallId });
      },
      onToolCall: async (toolCall, tool) => {
        const start = Date.now();
        const displayMode = getToolDisplayMode(toolCall.name);

        // Always emit tool-input-start so UI shows the tool is running
        if (onProgress) {
          onProgress({
            status: 'tool-input-start',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            args: displayMode === 'full' ? toolCall.args : undefined,
            depth,
            parentToolCallId,
          });
        }

        const result = await tool.execute(toolCall.args, {
          userId,
          orgId,
          appId,
          depth,
          parentToolCallId: toolCall.id, // THE NEXT LEVEL'S PARENT IS THIS TOOL CALL'S ID
          currentSkillId: skillDef.id || skillDef.folderName,
          onProgress, // Propagate the progress listener into sub-tools
          taskId,
          executionId,
          sessionId,
          parentExecutionId: parentExecutionId || executionId,
        });

        // Only emit tool-result if displayMode is not 'name-only'
        if (onProgress && displayMode !== 'name-only') {
          const duration = Date.now() - start;
          onProgress({
            status: 'tool-result',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            duration,
            result,
            depth,
            parentToolCallId,
          });
        }

        return result;
      },
    });

    trace.append(
      traceId,
      'EXPERT',
      `[${skillDef.name}] Session completed. Content length: ${result.content?.length || 0}`,
    );

    // return {
    //   success: true,
    //   result: result.content,
    //   usage: result.usage,
    // };
    return result.content;
  }

  /**
   * Resolve the tools declared in skillDef.requires.tools, plus auto-discover
   * any sub-skills found in the skill's own folder.
   *
   * Resolution priority for non-system tools:
   *   1. Sub-skill folders inside the current skillFolder (private, highest priority)
   *   2. Global PACKAGE_SKILL registry (shared, lower priority)
   *
   * System tools (prefixed with "system:") are always resolved from staticTools.
   */
  async _resolveTools(skillDef, subAgentContext) {
    const requiredToolIds = skillDef.requires?.tools || [];
    console.log('_resolveTools', requiredToolIds);
    const resolved = [];
    const promptSnippets = [];

    const { default: skillService } = await import('../services/skill.service.js');
    const allAvailable = await skillService.getAvailableSkills({
      ...subAgentContext,
      requestedIds: requiredToolIds,
    });

    // 1. Auto-discover ALL sub-skills from the skill's own folder.
    const subSkills = await this._discoverSubSkills(skillDef.implementationRef);

    // Combine explicit requires and auto-discovered sub-skills
    const allCandidates = [...subSkills];
    for (const toolId of requiredToolIds) {
      // SECURITY & FOCUS: Prevent expert agents from accessing global discovery tools like 'read_skill'
      // They should use 'read_skill_resource' for their local sandbox.
      if (toolId === 'read_skill' || toolId === 'readSkill' || toolId?.includes('read_skill')) {
        continue;
      }

      const globalTool = allAvailable.find((s) => s.name === toolId || s.id === toolId);
      if (globalTool && !allCandidates.some((c) => c.name === globalTool.name)) {
        allCandidates.push(globalTool);
      }
    }

    // 2. Process Candidates: Sort into Tools vs XML Prompts
    for (const candidate of allCandidates) {
      if (candidate.type === 'PACKAGE_SKILL') {
        const hasParams =
          candidate.inputSchema?.properties &&
          Object.keys(candidate.inputSchema.properties).length > 0;

        // Force Sub-Agent mode if skill has parameters OR private resources
        const isComplex = hasParams || !!candidate.hasResources;

        if (isComplex) {
          // Complex Skills -> Wrapped as Tools (Executed as Sub-Agent)
          resolved.push(
            wrapSkillAsTool(candidate, {
              ...subAgentContext,
              depth: (subAgentContext.depth || 0) + 1,
              parentToolCallId, // The sub-expert's parent is the CURRENT Expert's parent?
              // Wait! NO. The sub-expert's parent is the CURRENT tool call ID!
              onProgress: subAgentContext.onProgress,
            }),
          );
        } else {
          // Simple SOP Skills -> Flattened XML Snippets
          promptSnippets.push(formatSkillDiscoverySnippet(candidate));
        }
      } else {
        // Other types (WORKFLOW, CODE, SYSTEM, MCP, etc.) always stay as technical Tools
        resolved.push(
          wrapSkillAsTool(candidate, {
            ...subAgentContext,
            onProgress: subAgentContext.onProgress,
          }),
        );
      }
    }

    const xmlPrompts = getSkillDiscoveryPrompt(promptSnippets);

    return { tools: resolved, xmlPrompts };
  }

  /**
   * Scan the skill's own folder for sub-skill directories.
   */
  async _discoverSubSkills(skillFolder) {
    const subSkills = [];
    let entries;

    if (!skillFolder) return subSkills;

    try {
      entries = fs.readdirSync(skillFolder, { withFileTypes: true });
    } catch {
      return subSkills;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const subFolder = path.join(skillFolder, entry.name);
      const subSkillMdPath = path.join(subFolder, 'SKILL.md');

      if (!fs.existsSync(subSkillMdPath)) continue;

      let parsed;
      try {
        const { default: skillService } = await import('../services/skill.service.js');
        // Now using async version that handles the path resolving implicitly
        parsed = await skillService.parseSkillMd(subFolder);
      } catch {
        continue;
      }

      const { metadata } = parsed;
      if (!metadata.name || !metadata.description) continue;

      const hasReferences = fs.existsSync(path.join(subFolder, 'references'));
      const hasScripts = fs.existsSync(path.join(subFolder, 'scripts'));

      subSkills.push({
        name: metadata.name,
        description: metadata.description,
        implementationRef: subFolder,
        folderName: entry.name,
        hasResources: hasReferences || hasScripts,
        requires: metadata.requires || {},
        inputSchema: metadata.parameters || { type: 'object', properties: {} },
        type: 'PACKAGE_SKILL',
      });
    }

    return subSkills;
  }

  /**
   * Build private sandbox file tools locked to the skill's own folder.
   * These are only reachable within this SkillAgent instance.
   */
  _buildSandboxTools(skillFolder) {
    const safeResolve = (filename) => {
      const resolved = path.resolve(skillFolder, filename);
      if (!resolved.startsWith(path.resolve(skillFolder))) {
        throw new Error(`[SkillAgent] Path traversal detected: ${filename}`);
      }
      return resolved;
    };

    return [
      {
        name: 'list_skill_resources',
        description:
          '【强制性背景调研】：枚举该专家技能目录下所有的私有参考文档、业务流程 SOP、执行脚本或数据模板。在执行任何具有领域特殊性的任务前，你【必须】通过此工具对可用资产进行基准对齐，严禁凭经验猜测。',
        inputSchema: z.object({}),
        execute: () => {
          const results = { references: [], scripts: [] };
          const refsDir = path.join(skillFolder, 'references');
          const scriptsDir = path.join(skillFolder, 'scripts');
          if (fs.existsSync(refsDir)) {
            results.references = fs.readdirSync(refsDir).filter((f) => !f.startsWith('.'));
          }
          if (fs.existsSync(scriptsDir)) {
            results.scripts = fs.readdirSync(scriptsDir).filter((f) => !f.startsWith('.'));
          }
          return results;
        },
      },
      {
        name: 'read_skill_resource',
        description:
          '【读取地面真相】：具体加载某个资源文件的原始内容（Markdown、JSON 或脚本内容）。你必须提供来自 list_skill_resources 的有效文件路径，严禁凭空构造不存在的文件名。',
        inputSchema: z.object({
          filename: z
            .string()
            .describe('相对于技能根目录的资源文件路径 (例如: "references/specific-logic.md")'),
        }),
        execute: ({ filename }) => {
          const filePath = safeResolve(filename);
          if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filename}`);
          }
          return fs.readFileSync(filePath, 'utf-8');
        },
      },
      {
        name: 'record_skill_evolution',
        description:
          'RECORD GROWTH LOG: Summarize failure causes, debugging conclusions, or optimized procedures into the skill\'s local "references/evolution.md" log. Mandatory when tasks fail or complex logic is optimized to prevent repeating errors.',
        inputSchema: z.object({
          content: z
            .string()
            .describe(
              'The evolution summary, including diagnosis and future action points (Markdown).',
            ),
        }),
        execute: ({ content }) => {
          const filename = 'references/evolution.md';
          const filePath = safeResolve(filename);
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          const timestamp = new Date().toISOString();
          const logEntry = `\n### Evolution Log [${timestamp}]\n${content}\n---\n`;
          fs.appendFileSync(filePath, logEntry, 'utf-8');
          return { success: true, path: filename, action: 'append' };
        },
      },
    ];
  }
}

export default new SkillAgent();
