/**
 * Validates incoming triggerData against the parameters defined in the workflow's trigger node.
 * Returns { valid: true } or { valid: false, error: "..." }
 */
export const validateWorkflowInput = (workflowDef, triggerData) => {
  const nodes = workflowDef.nodes || [];

  // 监控入口
  console.log(
    '[Validator] Entry - nodes:',
    nodes.length,
    'triggerData keys:',
    Object.keys(triggerData),
  );

  // 1. Find the trigger node
  const triggerNode = nodes.find((n) =>
    [
      'schedule',
      'click',
      'trigger',
      'webhook',
      'dataChange',
      'capability',
      'plugin-trigger',
    ].includes(n.type),
  );

  if (!triggerNode) {
    console.log('[Validator] Skip - No trigger node found in this workflow');
    return { valid: true }; // No trigger node, skip validation
  }

  // 支持新字段 inputs, 同时兼容老字段 params
  const inputsDef = triggerNode.data?.inputs || triggerNode.data?.params || [];
  console.log('[Validator] InputsDef detected:', inputsDef.length, 'parameters');

  if (!Array.isArray(inputsDef) || inputsDef.length === 0) {
    return { valid: true };
  }

  // 2. Perform validation
  for (const p of inputsDef) {
    if (!p.name) continue;

    // 智能提取逻辑 (与引擎 logic.handler.js 保持一致)
    let value = triggerData[p.name];

    // 如果是必填
    if (p.required && (value === undefined || value === null || value === '')) {
      console.warn(`[Validator] Validation FAILED - ${p.name} is missing.`);
      return {
        valid: false,
        error: `Validation Failed: Required parameter "${p.name}" is missing or empty.`,
      };
    }

    // Optional: Basic Type validation (可扩展)
    if (value !== undefined && value !== null && value !== '') {
      if (p.type === 'number' && isNaN(Number(value))) {
        return {
          valid: false,
          error: `Validation Failed: Parameter "${p.name}" must be a number.`,
        };
      }
    }
  }

  console.log('[Validator] Validation PASSED');
  return { valid: true };
};

/**
 * Validates the overall structure of a workflow (e.g. presence of End node).
 * Returns { valid: true } or { valid: false, error: "..." }
 */
export const validateWorkflowStructure = (workflowData) => {
  const nodes = workflowData.nodes || [];

  // 1. Mandatory Trigger node
  const triggerNodes = nodes.filter((n) =>
    [
      'manual',
      'click',
      'webhook',
      'schedule',
      'dataChange',
      'capability',
      'plugin-trigger',
    ].includes(n.type),
  );

  if (triggerNodes.length === 0) {
    return {
      valid: false,
      error: 'Workflow validation failed: A workflow must have a trigger node.',
    };
  }

  if (triggerNodes.length > 1) {
    return {
      valid: false,
      error: 'Workflow validation failed: A workflow can only have one trigger node.',
    };
  }

  // 2. Mandatory End node
  const hasEndNode = nodes.some((n) => n.type === 'end');
  if (!hasEndNode) {
    return {
      valid: false,
      error: 'Workflow validation failed: Workflow must have at least one "End" node.',
    };
  }

  return { valid: true };
};
