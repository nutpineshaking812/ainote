import ApiError from '../utils/ApiError.js';
import { formRepository } from '../repositories/form.repository.js';
import { ERROR_CODES } from '../constants/errorCodes.js';

// 根据 formId 获取结构
export async function getSchemaById(formId) {
  if (!formId) throw ApiError.badRequest('缺少 formId');
  const form = await formRepository.findById(formId);
  if (!form) throw ApiError.notFound('表单不存在');
  return simplifyForm(form);
}

// 根据名称(或别名)获取结构
export async function getSchemaByName(name) {
  if (!name) throw ApiError.badRequest('缺少表单名称');
  console.log("getSchemaByName", name);
  const form = await formRepository.findOne({
    where: (t, d) => d.eq(t.name, name)
  });
  if (!form) throw ApiError.notFound('表单不存在');
  return simplifyForm(form);
}

function simplifyForm(form) {
  return form;
}

// 构建统一缓存
let _schemaCache = null;
export async function buildUnifiedSchemaCache() {
  const forms = await formRepository.findAll();
  _schemaCache = forms.map(simplifyForm);
  return _schemaCache;
}

export function getUnifiedSchemaCache() {
  return _schemaCache;
}

export default {
  getSchemaById,
  getSchemaByName,
  buildUnifiedSchemaCache,
  getUnifiedSchemaCache,
  getDistinctValues,
};

// 新增: 根据 formId 或 form 名称与字段 label 获取该字段的去重值列表
// 支持可选 limit 与排序, 并处理字段不存在的情况。
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { formRecords as formRecordsTable } from '../db/schema/index.js';

/**
 * 获取指定表单字段的去重值
 * @param {object} params
 * @param {string} [params.formId] - 表单ID (优先)
 * @param {string} [params.formName] - 表单名称 (当 formId 未提供时使用)
 * @param {string} params.fieldLabel - 字段显示名称 (schema.fields[].properties.label)
 * @param {number} [params.limit=100] - 返回最大数量
 * @param {boolean} [params.sortAsc=true] - 是否按升序排序
 * @returns {Promise<{values: any[], fieldId: string|null, total: number}>}
 */
// 简化版：仅支持 (formId, fieldId, options?) 调用，返回值数组
export async function getDistinctValues(formId, fieldId, options = {}) {
  if (!formId) throw ApiError.badRequest('缺少 formId');
  if (!fieldId) throw ApiError.badRequest('缺少 fieldId');
  const { limit = 100, sortAsc = true } = options;
  const schema = await getSchemaById(formId);
  if (!schema) throw ApiError.notFound('未找到表单结构');
  // 优先处理静态下拉选项: 直接返回定义中的 label 列表
  // const fieldDef = (schema.fields || []).find(f => f.id === fieldId);
  // let labelMap = [];
  // if (fieldDef && fieldDef.properties?.type === 'dropdown' && fieldDef.properties?.optionsSource?.mode === 'static') {
  //   labelMap = (fieldDef.properties.options || []).map(opt => ({value: opt.value, label: opt.label}));
  // }
  
  const sqlQuery = sql`SELECT DISTINCT ${formRecordsTable.data}->>${fieldId} as value FROM ${formRecordsTable} WHERE ${formRecordsTable.formId} = ${schema.id}`;
  const { rows } = await db.execute(sqlQuery);
  let distinctValues = rows.map(r => r.value);
  // if (labelMap.length > 0) {
  //   distinctValues = distinctValues.map(v => {
  //     console.log('Mapping value', v, 'to label');
  //     return labelMap[v];
  //   });
  // }
  // console.log('Distinct values for form', formId, 'field', fieldId, ':', distinctValues);
  distinctValues = distinctValues.filter(v => v !== null && v !== undefined && v !== '');
  distinctValues.sort((a, b) => (
    typeof a === 'number' && typeof b === 'number'
      ? (sortAsc ? a - b : b - a)
      : (sortAsc ? String(a).localeCompare(String(b)) : String(b).localeCompare(String(a)))
  ));
  return distinctValues.slice(0, limit);
}
