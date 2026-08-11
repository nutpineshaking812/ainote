import dayjs from './dayjs';

/**
 * Utility to resolve system variables for form pre-filling.
 */

const getBrowserInfo = () => {
  if (typeof window === 'undefined') return '';
  const ua = window.navigator.userAgent;
  return `${window.navigator.platform} - ${ua}`;
};

/**
 * Resolves system variables from a context object.
 * @param {Object} mapping - { fieldId: variablePattern | { variable, hidden, readOnly } }
 * @param {Object} context - { user, organization, ... }
 * @returns {Object} initialValues { fieldId: value }
 */
export const resolveVariables = (mapping = {}, context = {}) => {
  if (!mapping || typeof mapping !== 'object') return {};

  const { user = {}, organization = {} } = context;
  const initialValues = {};

  const resolvers = {
    '$USER_NAME': user.name || user.username || '',
    '$USER_ID': user._id || user.id || '',
    '$USER_EMAIL': user.email || '',
    '$ORG_NAME': organization.name || '',
    '$ORG_ID': organization._id || organization.id || '',
    '$CURRENT_PAGE_URL': typeof window !== 'undefined' ? window.location.href : '',
    '$CURRENT_DATE': dayjs(),
    '$BROWSER_INFO': getBrowserInfo(),
  };

  Object.entries(mapping).forEach(([fieldId, mappingValue]) => {
    // Determine variable string based on whether it's an object or string
    const variable = typeof mappingValue === 'object' ? mappingValue.variable : mappingValue;
    
    if (!variable) return;

    // Exactly match a systemic variable
    if (resolvers[variable] !== undefined) {
      initialValues[fieldId] = resolvers[variable];
    } else {
      // Fallback: If it starts with $, try to look up literally in resolvers (case insensitive)
      const upperVar = variable?.toUpperCase();
      if (resolvers[upperVar] !== undefined) {
        initialValues[fieldId] = resolvers[upperVar];
      }
    }
  });

  return initialValues;
};

/**
 * Extracts field overrides (hidden, readOnly) from mapping.
 * @param {Object} mapping - { fieldId: { variable, hidden, readOnly } }
 * @returns {Object} overrides { fieldId: { hidden, readOnly } }
 */
export const resolveOverrides = (mapping = {}) => {
  if (!mapping || typeof mapping !== 'object') return {};
  
  const overrides = {};
  Object.entries(mapping).forEach(([fieldId, mappingValue]) => {
    if (typeof mappingValue === 'object') {
      const { hidden, readOnly } = mappingValue;
      if (hidden !== undefined || readOnly !== undefined) {
        overrides[fieldId] = { hidden, readOnly };
      }
    }
  });
  return overrides;
};

/**
 * Parses a single string for variables (like a template).
 */
export const parseTemplate = (template = '', context = {}) => {
  if (typeof template !== 'string') return template;
  
  const initialValues = resolveVariables({ temp: template }, context);
  return initialValues.temp ?? template;
};

export default {
  resolveVariables,
  resolveOverrides,
  parseTemplate,
};
