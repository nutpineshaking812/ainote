import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import env from '../../../config/env.js';
import PackageSkillRepository from '../../../repositories/packageSkill.repository.js';
import { jsonSchemaToZod } from '../../utils/schema_converter.js';
import { logger } from '../../../config/logger.js';
import documentService from '../../../services/document.service.js';
import { blocksToMarkdown } from '../../../utils/contentProcessor.js';

const SKILLS_DIR = env.SKILLS_DIR;

/**
 * Safe resolve for skill-related paths
 */
const getSkillPath = (folderName, subPath = '') => {
  const skillFolder = path.join(SKILLS_DIR, folderName);
  if (!fs.existsSync(skillFolder)) return null;
  const resolved = path.resolve(skillFolder, subPath);
  if (!resolved.startsWith(path.resolve(skillFolder))) {
    throw new Error(`[SkillTools] Security: Path traversal blocked - ${subPath}`);
  }
  return resolved;
};

/**
 * read_skill
 * Extracts SOP from a skill.
 */
export const readSkill = {
  isGlobal: true,
  name: 'read_skill',
  description:
    '【技能规范同步】：加载指定技能的实时标准作业程序 (SOP) 并装载业务数据。由于系统规格（如参数定义、逻辑出口）会随版本更新而变动，你【禁止】仅凭记忆猜测其实现细节，必须通过此工具同步最新的地面真相 (Ground Truth)。',
  inputSchema: z.object({
    location: z.string().describe('技能的 <location> 唯一标识符'),
    args: z
      .record(z.string(), z.any())
      .optional()
      .describe('传给该技能的初始化参数（如有），用于结合 SOP 解决具体任务。'),
  }),
  execute: async ({ location, args }, context) => {
    const { orgId, userId } = context || {};

    if (!location) {
      throw new Error('Missing "location" argument for read_skill.');
    }

    let resolvedLocation = location;
    if (!location.startsWith('pkg:') && !location.startsWith('doc:')) {
      const { default: skillService } = await import('../../../services/skill.service.js');
      const skills = await skillService.getAvailableSkills(context);
      const matchedSkill = skills.find((s) => s.name === location || s.label === location);
      if (matchedSkill) {
        resolvedLocation = matchedSkill.id;
      }
    }

    let rawContent = '';
    if (resolvedLocation.startsWith('pkg:')) {
      const cleanId = resolvedLocation.replace(/^(pkg|doc):/, '');

      let skillRecord = await PackageSkillRepository.findById(cleanId);
      if (!skillRecord) {
        skillRecord = await PackageSkillRepository.findByFolderName(cleanId);
      }

      if (!skillRecord) throw new Error(`Skill definition not found: ${resolvedLocation}`);

      // 2. Load and Parse Content
      const filePath = getSkillPath(skillRecord.folderName, 'SKILL.md');
      if (!filePath || !fs.existsSync(filePath))
        throw new Error(`SKILL.md missing for: ${resolvedLocation}`);
      rawContent = fs.readFileSync(filePath, 'utf-8');
    } else {
      const docId = resolvedLocation.replace(/^(pkg|doc):/, '');
      const resolvedUserId = context?.userId || null;
      const doc = await documentService.getSingle(docId, resolvedUserId);
      rawContent = await blocksToMarkdown(doc.blocks, { serverRuntime: true });
    }

    // Reuse parsing logic from SkillService to ensure consistency across the system
    const { default: skillService } = await import('../../../services/skill.service.js');
    const { meta, content: sop } = skillService._parseMetadataAndContent(rawContent);

    const { getSkillContextPrompt } = await import('../../prompts/discovery.js');
    return getSkillContextPrompt(resolvedLocation, args, meta, sop);
  },
};

/**
 * read_skill_resource
 */
export const readSkillResource = {
  isGlobal: true,
  name: 'read_skill_resource',
  description:
    '【真相提取】：精读并加载技能目录下的特定逻辑文件、SOP 细则或数据模型内容。必须配合 list_skill_resources 确认路径存在后使用，严禁盲目读取不存在的文件。',
  inputSchema: z.object({
    location: z.string().describe('技能的 <location> 唯一标识符。'),
    path: z.string().describe('相对于技能根目录的文件路径 (如: "references/logic.md")。'),
  }),
  execute: async ({ location, path: subPath }, context) => {
    if (!location || !subPath) {
      throw new Error('Missing "location" and "path" arguments.');
    }

    const cleanId = location.replace(/^(pkg|doc):/, '');
    let skill = await PackageSkillRepository.findById(cleanId);
    if (!skill) {
      skill = await PackageSkillRepository.findByFolderName(cleanId);
    }

    if (!skill) throw new Error(`Skill not found for resource access: ${location}`);

    const targetPath = getSkillPath(skill.folderName, subPath);
    if (!targetPath || !fs.existsSync(targetPath))
      throw new Error(`Resource not found: ${subPath}`);

    return fs.readFileSync(targetPath, 'utf-8');
  },
};

/**
 * list_skill_resources
 */
export const listSkillResources = {
  isGlobal: true,
  name: 'list_skill_resources',
  description:
    '【资源深度发现】：为了解决复杂或数据密集的业务需求，你必须首先同步技能仓库中的非标准资产（如参考文档、业务 SOP 增量日志、私有脚本）。严禁在未查看资源列表的情况下对可用依赖做出假设。',
  inputSchema: z.object({
    location: z.string().describe('技能的 <location> 标识符。例如 "workflow-designer"。'),
  }),
  execute: async (args, context) => {
    const location = args.location || args.skill_name;
    if (!location) throw new Error('Missing "location" argument.');

    const cleanId = location.replace(/^(pkg|doc):/, '');
    let skill = await PackageSkillRepository.findById(cleanId);
    if (!skill) {
      skill = await PackageSkillRepository.findByFolderName(cleanId);
    }

    if (!skill) throw new Error(`Skill not found: ${location}`);

    const skillDir = getSkillPath(skill.folderName);
    if (!skillDir) throw new Error(`Physical folder missing for: ${location}`);

    const files = [];
    const scan = (dir, relPath = '') => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (item === 'node_modules' || item.startsWith('.')) continue;
        const fullPath = path.join(dir, item);
        const relative = path.join(relPath, item);
        if (fs.statSync(fullPath).isDirectory()) {
          scan(fullPath, relative);
        } else {
          if (item !== 'SKILL.md' && item !== 'package.json') {
            files.push(relative);
          }
        }
      }
    };

    scan(skillDir);
    if (files.length === 0) return `No extra resources found for skill "${location}".`;

    return `### Found ${files.length} Resources for Skill: ${location}
The following files are available within the skill's private vault. Use 'read_skill_resource' to access their contents:

${files.map((f) => `- ${f}`).join('\n')}

**Next Step Guidance**:
- Use 'read_skill_resource' with 'location="${location}"' and 'path="[one of the paths above]"' to retrieve the content.`;
  },
};

/**
 * write_skill_evolution
 */
export const writeSkillEvolution = {
  // isGlobal: true,
  name: 'write_skill_evolution',
  description: '将本次执行的心得、发现或自动生成的 SOP 增强内容记录到技能的进化历史中。',
  inputSchema: z.object({
    serviceId: z.string().describe('技能的 <location> ID'),
    findings: z.string().describe('具体的进化发现、优化建议或执行总结'),
  }),
  execute: async ({ serviceId, findings }, context) => {
    const cleanId = serviceId.replace(/^(pkg|doc):/, '');
    let skill = await PackageSkillRepository.findById(cleanId);
    if (!skill) {
      skill = await PackageSkillRepository.findByFolderName(cleanId);
    }

    if (!skill) throw new Error(`Skill not found for evolution: ${serviceId}`);

    const evoDir = getSkillPath(skill.folderName, 'history');
    if (!fs.existsSync(evoDir)) fs.mkdirSync(evoDir, { recursive: true });

    const evoPath = path.join(evoDir, 'evolution.md');
    const timestamp = new Date().toLocaleString('zh-CN');
    const entry = `\n\n## Evolution [${timestamp}]\n- **Task Context**: ${context.taskId || 'Manual'}\n- **Findings**:\n${findings}\n`;

    fs.appendFileSync(evoPath, entry);
    logger.info({ serviceId }, 'Skill evolution recorded');

    return `Evolution recorded successfully for ${serviceId}. Path: history/evolution.md`;
  },
};

/**
 * wrapSkillAsTool
 */
export const wrapSkillAsTool = (skillDef, context) => {
  return {
    id: skillDef.id,
    label: skillDef.label,
    type: skillDef.type,
    name: skillDef.name,
    description: skillDef.description,
    inputSchema:
      skillDef.inputSchema && typeof skillDef.inputSchema.safeParse === 'function'
        ? skillDef.inputSchema
        : jsonSchemaToZod(skillDef.inputSchema),
    execute: async (args, subContext) => {
      const mergedContext = { ...context, ...subContext };
      const { default: skillService } = await import('../../../services/skill.service.js');
      if (skillDef.type === 'PACKAGE_SKILL') {
        const { default: SkillAgent } = await import('../../SkillAgent.js');
        const sopContent = await skillService.loadSkillSop(skillDef.implementationRef);
        return await SkillAgent.run({ ...mergedContext, skillDef, sopContent, args });
      }
      return await skillService.execute(skillDef, args, mergedContext);
    },
  };
};
