import { z } from 'zod';
import ApiError from '../../../utils/ApiError.js';
import { formRepository } from '../../../repositories/form.repository.js';

export const getSchemaById = {
  name: 'get_schema_by_id',
  inputSchema: z.object({
    formId: z.string().describe('表单ID'),
  }),
  description: '通过 formId 获取指定表单的详细结构定义（检测关联外部表单时使用）',
  execute: async ({ formId }, context) => {
    if (!formId) throw ApiError.badRequest('缺少 formId');
    const schema = await formRepository.findById(formId);
    // console.log('get_schema_by_id=>formId', formId, 'schema?.fields===>', schema?.fields);
    return schema?.fields || [];
  },
};
