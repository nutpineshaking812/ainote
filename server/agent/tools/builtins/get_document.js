import { z } from 'zod';
import documentService from '../../../services/document.service.js';
import { blocksToMarkdown, markdownToBlocks } from '../../../utils/contentProcessor.js';

export const createDocument = {
  name: 'create_document',
  description:
    '创建一篇新的文档。支持多种用途：\n' +
    '- 普通笔记 (purpose=NORMAL, 默认)：记录想法、会议纪要、工作日志等\n' +
    '- 可复用技能 (purpose=SKILL)：定义 AI Agent 可以调用的 SOP 流程，需填写 skillName、description\n' +
    '- 知识库条目 (purpose=KNOWLEDGE)：沉淀领域知识、FAQ、最佳实践\n' +
    '- AI 记忆 (docType=ai_memory)：让 AI 记住的短期/长期记忆，如用户偏好、历史决策\n' +
    '创建技能时，内容中可以用 [SKILL_REF: tool:xxx] 声明此技能需要用到的工具。',
  inputSchema: z.object({
    title: z.string().describe('文档标题'),
    content: z.string().describe('文档正文，Markdown 格式'),

    // 文档用途与类型
    purpose: z
      .enum(['NORMAL', 'SKILL', 'KNOWLEDGE'])
      .optional()
      .default('NORMAL')
      .describe('用途：NORMAL=普通笔记(默认)、SKILL=可复用技能SOP、KNOWLEDGE=知识库条目'),
    docType: z
      .enum(['general'])
      .optional()
      .describe('文档类型：general=普通文档(默认)'),

    // 技能相关
    skillName: z.string().optional().describe('技能名称，purpose=SKILL 时填写，如 "web-researcher"'),
    description: z.string().optional().describe('简短描述。SKILL 时作为技能描述，ai_memory 时作为记忆摘要'),
    parameters: z.record(z.string(), z.any()).optional().describe('技能的自定义参数配置（JSON 对象）'),

    // 元信息
    tags: z.array(z.string()).optional().describe('标签列表，方便后续检索'),

    // 关系
    parentId: z.string().optional().describe('父文档 ID，用于创建子文档'),

    // 兼容旧版参数
    formId: z.string().optional().describe('关联的表单 ID'),
    recordId: z.string().optional().describe('关联的记录 ID'),
  }),
  execute: async ({ title, content, ...rest }, context) => {
    const { userId, appId } = context;

    const body = {
      title,
      blocks: await markdownToBlocks(content),
      appId,
      ...rest,
    };
    const doc = await documentService.dispatchCreate(body, userId);
    return { id: doc._id, title: doc.title, purpose: doc.purpose || 'NORMAL' };
  },
};

// export const searchDocumentsTool = {
//   name: "search_documents",
//   description: "Search for documents by keyword.",
//   inputSchema: z.object({
//     query: z.string().describe("Search keywords"),
//     limit: z.number().optional().default(5).describe("Max number of results"),
//   }),
//   execute: async ({ query, limit }, options) => {
//     const experimental_context = options?.experimental_context || {};
//     const resolvedUserId = experimental_context.userId || null;
//     const result = await documentService.list({ search: query, limit, appId }, {}, resolvedUserId);
//     return result.docs.map(d => ({ id: d._id, title: d.title }));
//   }
// };

export const getDocument = {
  name: 'get_document',
  description:
    '根据文档 ID 获取文档完整内容（Markdown 格式）。\n' +
    '用于阅读笔记、加载技能 SOP、查询知识库条目、回顾 AI 记忆等场景。',
  inputSchema: z.object({
    docId: z.string().describe('文档 ID'),
  }),
  execute: async ({ docId }, context) => {
    // console.log('Executing getDocumentTool with docId:', docId);
    const resolvedUserId = context?.userId || null;
    // 如果不定义execute则直接输出toolCall
    try {
      const doc = await documentService.getSingle(docId, resolvedUserId);
      const markdown = await blocksToMarkdown(doc.blocks);
      return { id: doc._id, title: doc.title, markdown };
    } catch (err) {
      console.error('Error in getDocumentTool:', err);
      // throw err;
    }
    return {};
  },
};

export const updateDocument = {
  name: 'update_document',
  description:
    '更新已有文档的标题或内容。\n' +
    '适用于修改笔记、迭代技能 SOP、更新知识库条目、刷新记忆内容等。',
  inputSchema: z.object({
    docId: z.string().describe('文档 ID'),
    title: z.string().optional().describe('新标题'),
    content: z.string().optional().describe('新正文，Markdown 格式'),
  }),
  execute: async ({ docId, title, content }, context) => {
    const resolvedUserId = context?.userId || null;
    const body = {};
    if (title) body.title = title;
    if (content) body.blocks = content;
    const doc = await documentService.update(docId, body, resolvedUserId);
    return { id: doc._id, title: doc.title, status: 'updated' };
  },
};

export const deleteDocument = {
  name: 'delete_document',
  isGlobal: true,
  description: '删除指定 ID 的文档。请谨慎使用，删除后不可恢复。',
  inputSchema: z.object({
    docId: z.string().describe('要删除的文档 ID'),
  }),
  execute: async ({ docId }, context) => {
    const resolvedUserId = context?.userId || null;
    await documentService.remove(docId, resolvedUserId);
    return { status: 'deleted', id: docId };
  },
};
