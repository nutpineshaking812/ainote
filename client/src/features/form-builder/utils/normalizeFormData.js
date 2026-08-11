import { componentRegistry } from '../registry';

const ensureActions = (actions) => {
  if (Array.isArray(actions)) {
    return actions;
  }
  return [
    { type: 'submit', label: '提交' },
    { type: 'save_draft', label: '保存草稿' },
  ];
};

export const normalizeFormData = (rawForm) => {
  if (!rawForm || typeof rawForm !== 'object') {
    return null;
  }

  const rawFields = Array.isArray(rawForm.fields)
    ? rawForm.fields.filter((field) => field != null)
    : [];

  const normalizedFields = rawFields.map((field) => {
    const plugin = componentRegistry.get(field.type);
    const resolvedRecordable = (() => {
      if (field.recordable === false) return false;
      if (field.recordable === true) return true;
      return plugin?.recordable === false ? false : true;
    })();

    const validation =
      field.validation && typeof field.validation === 'object' ? { ...field.validation } : {};

    return {
      ...field,
      recordable: resolvedRecordable,
      validation,
    };
  });

  return {
    ...rawForm,
    fields: normalizedFields,
    actions: ensureActions(rawForm.actions),
  };
};
