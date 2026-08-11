export const groupFieldsIntoRows = (fields, placeholderIndex = -1, draggedFieldId = null) => {
  let fieldsToGroup = [...fields];
  // Always ensure there is a placeholder object in the node tree. When
  // placeholderIndex is a valid index (not -1) we insert the placeholder at
  // that position and mark it active; otherwise append an inactive placeholder
  // at the end so the DOM node exists but is not shown.
  const placeholderObj = {
    id: 'placeholder',
    type: 'placeholder',
    layout: { span: 24 },
    active: false,
  };
  if (placeholderIndex !== -1 && placeholderIndex <= fields.length) {
    // If the placeholder index corresponds to the dragged field's original
    // index, keep the original behavior: don't insert the placeholder object
    // at that index (the dragged field itself will render as the visual
    // placeholder). Still append an inactive placeholder so the node exists.
    if (
      draggedFieldId &&
      fields[placeholderIndex] &&
      fields[placeholderIndex].id === draggedFieldId
    ) {
      // append inactive placeholder
      fieldsToGroup.splice(fieldsToGroup.length, 0, { ...placeholderObj, active: false });
    } else {
      // insert active placeholder at the desired index
      fieldsToGroup.splice(placeholderIndex, 0, { ...placeholderObj, active: true });
    }
  } else {
    // no active placeholder; append inactive placeholder so it's always present
    fieldsToGroup.splice(fieldsToGroup.length, 0, { ...placeholderObj, active: false });
  }
  const rows = [];
  let currentRow = [];
  let currentSpanSum = 0;
  fieldsToGroup.forEach((field) => {
    const fieldSpan = field.layout?.span || 24;
    if (currentSpanSum + fieldSpan <= 24) {
      currentRow.push(field);
      currentSpanSum += fieldSpan;
    } else {
      rows.push(currentRow);
      currentRow = [field];
      currentSpanSum = fieldSpan;
    }
  });
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }
  return rows;
};
