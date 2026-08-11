// Utility to validate form field structures before persistence or export
// Ensures validation object has proper types: required:boolean, min/max:number, pattern:string
// Throws Error with message describing first encountered problem.

function validateFieldsStructure(fields) {
  if (!Array.isArray(fields)) return;
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (!f || typeof f !== 'object') continue;
    const { id, type, properties, validation } = f;
    if (!id || typeof id !== 'string') throw new Error(`字段索引 ${i} 缺少字符串 id`);
    if (!type || typeof type !== 'string') throw new Error(`字段 ${id} 缺少 type`);
    if (validation) {
      if (typeof validation.required !== 'undefined' && typeof validation.required !== 'boolean') {
        throw new Error(`字段 ${id} 的 validation.required 必须是布尔`);
      }
      if (typeof validation.min !== 'undefined' && typeof validation.min !== 'number') {
        throw new Error(`字段 ${id} 的 validation.min 必须是数字或未定义`);
      }
      if (typeof validation.max !== 'undefined' && typeof validation.max !== 'number') {
        throw new Error(`字段 ${id} 的 validation.max 必须是数字或未定义`);
      }
      if (typeof validation.pattern !== 'undefined' && typeof validation.pattern !== 'string') {
        throw new Error(`字段 ${id} 的 validation.pattern 必须是字符串或未定义`);
      }
      if (typeof validation.min === 'number' && typeof validation.max === 'number' && validation.min > validation.max) {
        throw new Error(`字段 ${id} 的 min 不可大于 max`);
      }
    }
  }
}

export { validateFieldsStructure };
