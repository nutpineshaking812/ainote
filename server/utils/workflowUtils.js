import { ApiError } from './ApiError.js';

export const TRIGGER_TYPES = [
  'schedule',
  'click',
  'trigger',
  'webhook',
  'dataChange',
  'capability',
  'plugin-trigger',
];

/**
 * Validates that a workflow has exactly one trigger node.
 * @param {Array} nodes - Workflow nodes
 * @returns {string} The type of the trigger node found
 */
export function validateTriggerNode(nodes) {
  if (!nodes || !Array.isArray(nodes)) return null;

  const triggerCount = nodes.filter((n) => TRIGGER_TYPES.includes(n.type)).length;

  if (triggerCount === 0) {
    throw ApiError.badRequest(
      'Workflow must have exactly one trigger node (Schedule, Webhook, Manual/Click, or Data Change)',
    );
  }

  if (triggerCount > 1) {
    throw ApiError.badRequest(`Workflow has ${triggerCount} trigger nodes. Only one is allowed.`);
  }

  const triggerNode = nodes.find((n) => TRIGGER_TYPES.includes(n.type));
  return triggerNode ? triggerNode.type : null;
}

/**
 * Maps a node type to a database-friendly TriggerType.
 * @param {string} nodeType - The UI node type (e.g., 'click')
 * @returns {string} The DB trigger type (e.g., 'MANUAL')
 */
export function resolveTriggerType(nodeType) {
  if (!nodeType) return 'MANUAL';
  switch (nodeType) {
    case 'click':
      return 'MANUAL';
    case 'schedule':
      return 'SCHEDULE';
    case 'webhook':
      return 'WEBHOOK';
    case 'dataChange':
      return 'DATACHANGE';
    case 'capability':
      return 'CAPABILITY';
    case 'plugin-trigger':
      return 'PLUGIN';
    default:
      return 'MANUAL';
  }
}

/**
 * Merges configured default values/mappings from triggerNode.data.inputs/params into triggerData.
 * @param {Array} nodes - Workflow nodes
 * @param {Object} triggerData - Target trigger data to mutate
 * @returns {Object} Target trigger data
 */
export function mergeTriggerDefaults(nodes, triggerData) {
  if (!nodes || !Array.isArray(nodes) || !triggerData) return triggerData || {};
  const triggerNode = nodes.find((n) => TRIGGER_TYPES.includes(n.type));
  if (!triggerNode) return triggerData;

  const configuredInputs = triggerNode.data?.inputs || triggerNode.data?.params || [];
  if (Array.isArray(configuredInputs)) {
    for (const input of configuredInputs) {
      if (input && input.name && input.value !== undefined) {
        const val = triggerData[input.name];
        if (val === undefined || val === null || val === '') {
          triggerData[input.name] = input.value;
        }
      }
    }
  }
  console.log("triggerData", triggerData, configuredInputs);
  return triggerData;
}

export default {
  TRIGGER_TYPES,
  validateTriggerNode,
  resolveTriggerType,
  mergeTriggerDefaults,
};
