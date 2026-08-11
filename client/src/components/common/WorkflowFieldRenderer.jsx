import React from 'react';
import { Input, Form } from 'antd';
import { PROPERTY_INPUTS_REGISTRY } from '../../pages/workflow/components/PropertyInputs';
import { isTauri } from '../../utils/platform';

/**
 * Unified Field Renderer for Workflow Parameters and Digital Employee Configuration.
 * Maps schema definitions to consistent UI components.
 */
const WorkflowFieldRenderer = ({
  field,
  appId,
  nodes = [],
  currentNodeId,
  useVariableInput = false,
  ...props
}) => {
  const { name, type, label, description, required, isSystem, placeholder } = field;

  // 1. Determine the component based on type or specific names
  // Priority: Registry lookup by type -> Registry lookup by name -> Default Input
  let Component = PROPERTY_INPUTS_REGISTRY[type] || PROPERTY_INPUTS_REGISTRY[name] || Input;

  // If inside designer and is a basic type, force VariableInput to allow binding variables
  if (useVariableInput && ['string', 'number', 'boolean', 'switch', 'textarea'].includes(type)) {
    Component = PROPERTY_INPUTS_REGISTRY.variableInput || Component;
  }

  // 2. Prepare common props
  const commonProps = {
    appId,
    nodes,
    currentNodeId,
    placeholder: placeholder || `Enter ${label || name}...`,
    ...props,
  };

  return <Component {...commonProps} />;
};

/**
 * Helper to render a list of fields as Form.Items
 */
export const renderWorkflowFormItems = (
  fields,
  appId,
  nodes = [],
  currentNodeId,
  options = {}
) => {
  if (!fields || !Array.isArray(fields)) return null;
  const { isFormList = false, useVariableInput = false, isDesignerMode = false } = options;

  const visibleFields = fields.filter((field) => {
    if (!isDesignerMode && (field.isSystem || field.name === 'message')) return false;
    if (field.type === 'workspacePath' && !isTauri) return false;
    return true;
  });

  return visibleFields.map((field, idx) => {

    const type = field.type || 'string';
    const labelText = field.label || field.name;
    const isRequired = field.required === true;

    // Construct name path: if inside Form.List, use [idx, 'value'] which AntD Form prefixes automatically
    const namePath = isFormList ? [idx, 'value'] : field.name;

    const valProp = (!useVariableInput && (type === 'boolean' || type === 'switch')) ? 'checked' : 'value';

    return (
      <React.Fragment key={field.name || idx}>
        {isFormList && (
          <>
            <Form.Item name={[idx, 'name']} hidden noStyle><Input /></Form.Item>
            <Form.Item name={[idx, 'label']} hidden noStyle><Input /></Form.Item>
            <Form.Item name={[idx, 'type']} hidden noStyle><Input /></Form.Item>
            <Form.Item name={[idx, 'required']} valuePropName="checked" hidden noStyle><Input /></Form.Item>
            {field.isSystem && <Form.Item name={[idx, 'isSystem']} valuePropName="checked" hidden noStyle><Input /></Form.Item>}
            {field.description && <Form.Item name={[idx, 'description']} hidden noStyle><Input /></Form.Item>}
          </>
        )}
        <Form.Item
          name={namePath}
          label={labelText}
          tooltip={field.description}
          rules={[{ required: isRequired, message: `${labelText} is required` }]}
          valuePropName={valProp}
        >
          <WorkflowFieldRenderer
            field={field}
            appId={appId}
            nodes={nodes}
            currentNodeId={currentNodeId}
            useVariableInput={useVariableInput}
            size="small"
          />
        </Form.Item>
      </React.Fragment>
    );
  });
};

export default WorkflowFieldRenderer;
