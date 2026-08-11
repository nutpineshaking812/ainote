import formRecordService from '../../../services/formRecord.service.js';

/**
 * 写入表单数据插件处理器 (Write Form Record Plugin Handler)
 * @param {Object} params 用户配置的输入数据 (包含 formId, formData)
 * @param {Object} ctx 平台提供的上下文
 */
export async function handler(params, ctx) {
  const { formId, formData, upsert } = params;
  const { executorId: userId } = ctx;

  if (!formId) {
    throw new Error('Target Form ID must be specified.');
  }

  if (formData === undefined || formData === null) {
    throw new Error('Form data cannot be empty.');
  }

  ctx.logger.info(`[Plugin/CreateFormRecord] Processing form submission for formId: ${formId} (upsert: ${upsert})...`);

  // 1. 解析 formData (支持 JSON 字符串、原生键值对对象与原生数组)
  let parsedData;
  if (typeof formData === 'object' && formData !== null) {
    parsedData = formData;
  } else if (typeof formData === 'string') {
    const trimmed = formData.trim();
    if (trimmed.length > 0) {
      try {
        parsedData = JSON.parse(trimmed);
      } catch (e) {
        throw new Error(`Failed to parse formData as JSON: ${e.message}. Provided content: ${trimmed}`);
      }
    }
  } else {
    throw new Error('formData must be a valid JSON string, key-value object, or array.');
  }

  // 2. 直接调用具备完美事务支持、联合唯一性冲突校验及 Upsert 重塑的批量入库核心服务
  try {
    const isBatch = Array.isArray(parsedData);
    const itemsToInsert = isBatch ? parsedData : [parsedData];

    const batchResult = await formRecordService.createFormRecordsBatch(formId, userId || null, itemsToInsert, {
      upsert: upsert === true || upsert === 'true',
    });

    const recordIds = batchResult.ids || [];

    ctx.logger.info(`[Plugin/CreateFormRecord] Processed ${recordIds.length} records successfully.`);

    return {
      success: true,
      recordIds: recordIds,
      count: recordIds.length
    };
  } catch (err) {
    ctx.logger.error({ err: err.stack || err, formId }, '[Plugin/CreateFormRecord] Failed to write form record');
    throw err;
  }
}
