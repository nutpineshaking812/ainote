export function getDisplayLabel(field, plugin, showIndex = false, displayIndex = null) {
  const label = field?.properties?.label || (plugin ? plugin.label : '字段');
  if (showIndex && displayIndex) {
    return `${displayIndex}. ${label}`;
  }
  return label;
}

export function isFieldRequired(field) {
  return !!field?.validation?.required;
}
