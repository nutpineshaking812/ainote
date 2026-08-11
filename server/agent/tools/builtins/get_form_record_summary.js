import { z } from "zod";
import { formRepository } from "../../../repositories/form.repository.js";
import { formRecordRepository } from "../../../repositories/formRecord.repository.js";

// 工具级别常量：限制最多返回多少条记录，避免一次性返回过多数据
const MAX_RECORD_LIMIT = 50;

// 将表单配置中的字段信息整理为统一结构，方便后续遍历
const normalizeFieldMeta = (fields = []) => {
  return fields.map((field, idx) => {
    const fieldId = field.id || field._id || field.fieldId || field.name || `field_${idx}`;
    return {
      fieldId,
      label: field.label || field.name || `字段${idx + 1}`,
      type: field.type || field.component || "text",
      options: field.options || undefined,
    };
  });
};

// 尝试从记录中的 data 字段读取对应字段的值（兼容 id、label 两种方式）
const extractFieldValue = (recordData = {}, fieldMeta) => {
  const direct = recordData[fieldMeta.fieldId];
  if (direct !== undefined) return direct;
  const byLabel = recordData[fieldMeta.label];
  if (byLabel !== undefined) return byLabel;
  return null;
};

export const getFormRecordSummary = {
  name: "get_form_record_summary",
  description:
    "根据 formId 获取该表单的字段定义与最近的提交数据，不会返回数据库原始记录，只会返回字段级别的摘要信息。",
  inputSchema: z.object({
    formId: z.string().describe("表单 ID。对应Schema的 _id 字段"),
    limit: z
      .number()
      .int()
      .positive()
      .max(MAX_RECORD_LIMIT)
      .default(10)
      .describe("需要返回的最近记录条数，最大 50 条"),
    includeEmptyFields: z
      .boolean()
      .optional()
      .default(false)
      .describe("是否在记录中包含空值字段，默认只返回有值的字段"),
  }),
  execute: async (args, context) => {
    // 限制 limit，防止一次请求读取过多记录
    const sanitizedLimit = Math.min(args.limit || 10, MAX_RECORD_LIMIT);

    // 读取表单配置，获取字段定义
    const form = await formRepository.findById(args.formId);
    if (!form) {
      throw new Error("Form not found");
    }

    const fieldMeta = normalizeFieldMeta(form.fields);
    const formIdStr = form.id;
 
    // 查询最近提交的数据，只取必要字段
    const records = await formRecordRepository.findByFormId(formIdStr, {
      limit: sanitizedLimit,
      sortBy: 'createdAt',
      order: 'desc'
    });

    const summarizedRecords = records.map((record) => {
      // 针对每条记录，提取出所有字段的值，并根据配置决定是否展示空值
      const fields = fieldMeta
        .map((meta) => ({
          fieldId: meta.fieldId,
          label: meta.label,
          type: meta.type,
          value: extractFieldValue(record.data, meta),
        }))
        .filter((item) => args.includeEmptyFields || !(item.value === null || item.value === undefined || item.value === ""));

      return {
        recordId: record.id,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        fields,
      };
    });

    return {
      // 表单基础信息摘要
      form: {
        id: form.id,
        name: form.name,
        description: form.description,
        appId: form.appId,
        fieldCount: fieldMeta.length,
      },
      // 字段配置（供 AI 理解字段含义）
      fields: fieldMeta,
      // 已脱敏的记录摘要
      records: summarizedRecords,
      returnedCount: summarizedRecords.length,
    };
  },
};
