import { z } from 'zod';
import { formRepository } from '../../../repositories/form.repository.js';

export const getAvailableForms = {
  name: 'get_available_forms',
  inputSchema: z.object({}),
  description: '返回一个包含所有可用表单名称的字符串列表。当需要知道有哪些表单可以分析时使用。',
  execute: async ({}, context) => {
    const appId = context.appId;
    let forms;
    if (appId) {
      forms = await formRepository.findByAppId(appId);
    } else {
      forms = await formRepository.findAll();
    }
    const names = forms.map((f) => ({
      formId: f.id,
      formName: f.name,
    }));
    return { forms: names, count: names.length, status: 'success' };
  },
};
