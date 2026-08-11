import { z } from 'zod';
import { formRepository } from '../../../repositories/form.repository.js';

export const getSchemaByName = {
  name: 'get_schema_by_name',
  inputSchema: z.object({
    formName: z.string().describe("要查询的表单名称，例如'花名册'"),
  }),
  description: '获取指定表单的详细结构定义，包含_id和字段数组。每个字段都有id和label。',
  execute: async ({ formName }, context) => {
    console.log(`getSchemaByName: formName=${formName}`);
    if (!formName) throw new Error('缺少 formName');
    const schema = await formRepository.findOne({
      where: (t, d) => d.eq(t.name, formName),
    });
    return schema?.fields || [];
  },
};
