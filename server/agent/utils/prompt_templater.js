/**
 * Sophisticated placeholder replacement for prompt templates.
 * 
 * Scans for `{{variable_name}}` and replaces it with the corresponding 
 * value from the given variables object.
 * 
 * @param {string} template - The prompt text containing placeholders.
 * @param {object} variables - The context/args object for values.
 * @returns {string} The processed prompt content.
 */
export function injectVariables(template, variables = {}) {
  if (!template) return '';
  if (!variables || typeof variables !== 'object') return template;

  return template.replace(/\{\{(.*?)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    const value = variables[trimmedKey];

    // If a value is provided, replace it. Otherwise, keep the placeholder.
    if (value !== undefined && value !== null) {
      // If object or array, JSON stringify for the prompt.
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    }

    return match;
  });
}
