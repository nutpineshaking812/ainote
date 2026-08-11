import { z } from 'zod';
import templateService from '../../../services/template.service.js';
import { blocksToMarkdown } from '../../../utils/contentProcessor.js';

export const getTemplateContent = {
  name: 'get_template_content',
  description: '根据模板 ID 获取模板内容并转换为 Markdown，便于在对话或生成任务中直接引用。',
  inputSchema: z.object({
    templateId: z.string().describe('模板 ID，对应模板的 _id'),
    includeMetadata: z
      .boolean()
      .optional()
      .default(true)
      .describe('是否在返回结果中包含描述、标签等额外信息，默认包含。'),
  }),
  execute: async (args, context) => {
    const resolvedUserId = context?.userId || null;
    const { templateId, includeMetadata = true } = args;
    if (!templateId) {
      throw new Error('templateId is required');
    }

    if (!resolvedUserId) {
      throw new Error('userId is required to fetch template content');
    }

    const template = await templateService.getTemplateById(templateId, resolvedUserId);
    const blocks = Array.isArray(template?.blocks) ? template.blocks : [];

    let markdown = '';
    try {
      markdown = await blocksToMarkdown(blocks);
    } catch (err) {
      markdown = '';
    }
    // console.log('[get_template_content] Generated markdown length:', markdown);

    const result = {
      id: template._id?.toString(),
      name: template.name,
      markdown,
    };

    if (includeMetadata) {
      result.description = template.description || '';
      result.scope = template.scope;
      result.tags = template.tags || [];
      result.appId = template.appId ? template.appId.toString() : null;
      result.updatedAt = template.updatedAt;
      result.createdAt = template.createdAt;
    }

    return result;
  },
};
