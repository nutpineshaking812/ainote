const resolveRecordableFlag = (field) => {
  if (!field || typeof field !== 'object') {
    return false;
  }
  if (field.recordable === false) {
    return false;
  }
  // Default to true so legacy records without the flag remain recordable
  return true;
};

const normalizeFieldValidationShape = (field) => {
  if (!field || typeof field !== 'object') {
    return field;
  }

  const rawValidation = field.validation && typeof field.validation === 'object' ? { ...field.validation } : {};
  const normalizedValidation = {};

  if (rawValidation.required === true) {
    normalizedValidation.required = true;
  }

  if (typeof rawValidation.pattern === 'string' && rawValidation.pattern) {
    normalizedValidation.pattern = rawValidation.pattern;
  }

  if (typeof rawValidation.min === 'number') {
    normalizedValidation.min = rawValidation.min;
  }

  if (typeof rawValidation.max === 'number') {
    normalizedValidation.max = rawValidation.max;
  }

  Object.keys(rawValidation || {}).forEach((key) => {
    if (key === 'required' || key === 'pattern' || key === 'min' || key === 'max') {
      return;
    }
    const value = rawValidation[key];
    if (value === undefined || value === null || value === '') {
      return;
    }
    normalizedValidation[key] = value;
  });

  const cleanedValidationKeys = Object.keys(normalizedValidation);
  const finalValidation = cleanedValidationKeys.length ? normalizedValidation : {};

  return {
    ...field,
    validation: finalValidation,
  };
};

const normalizeFieldsRecordable = (fields) => {
  if (!Array.isArray(fields)) {
    return fields;
  }
  return fields.map((field) => {
    if (!field || typeof field !== 'object') {
      return field;
    }
    const resolvedRecordable = resolveRecordableFlag(field);
    const nextField = field.recordable === resolvedRecordable ? field : { ...field, recordable: resolvedRecordable };
    return normalizeFieldValidationShape(nextField);
  });
};

const isRecordableField = (field) => resolveRecordableFlag(field);

const selectDataFields = (fields) => (Array.isArray(fields) ? fields.filter(isRecordableField) : []);

const sanitizeDataPayload = (fields, payload = {}) => {
  const dataFields = selectDataFields(fields);
  return dataFields.reduce((acc, field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field.id)) {
      acc[field.id] = payload[field.id];
    }
    return acc;
  }, {});
};

const isEmptyValue = (value) => {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
};

const buildSafeRegExp = (pattern) => {
  try {
    return new RegExp(pattern);
  } catch (err) {
    console.warn(`Invalid regex pattern provided: ${pattern}`, err.message);
    return null;
  }
};

const validateDataPayload = (fields, payload = {}, options = {}) => {
  const { mode = 'create' } = options;
  const dataFields = selectDataFields(fields);
  const errors = [];
  const isCreateMode = mode === 'create';

  dataFields.forEach((field) => {
    if (!field || typeof field !== 'object') return;
    const validation = field.validation || {};
    const label = field.properties?.label || field.id;
    const hasValue = Object.prototype.hasOwnProperty.call(payload, field.id);
    const value = payload[field.id];
    const empty = isEmptyValue(value);

    if (validation.required === true) {
      if (isCreateMode) {
        if (!hasValue || empty) {
          errors.push(`字段 ${label} 为必填项`);
          return;
        }
      } else if (hasValue && empty) {
        errors.push(`字段 ${label} 为必填项`);
        return;
      }
    }

    const patternString = typeof validation.pattern === 'string' ? validation.pattern : undefined;
    if (patternString) {
      if (!hasValue || empty) {
        return;
      }
      const regex = buildSafeRegExp(patternString);
      if (regex && !regex.test(typeof value === 'string' ? value : String(value))) {
        errors.push(`字段 ${label} 格式不正确`);
      }
    }
  });

  return errors;
};

export {
  isRecordableField,
  selectDataFields,
  sanitizeDataPayload,
  normalizeFieldsRecordable,
  validateDataPayload,
};
