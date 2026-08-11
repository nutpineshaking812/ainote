import React, { useState, useEffect } from 'react';
import { Form, Divider, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import NodePropertyCollapse from './NodePropertyCollapse';
import VariableInput from '../../components/PropertyInputs/VariableInput';
import { PROPERTY_INPUTS_REGISTRY } from '../../components/PropertyInputs';

const SkillNodeProperties = ({ node, setNodes, appId, currentNodeId }) => {
  const { t } = useTranslation();
  const SkillSelector = PROPERTY_INPUTS_REGISTRY.skills;

  // Local state for UI representation (handling both fixed IDs and dynamic expressions)
  const [localFixed, setLocalFixed] = useState([]);
  const [localDynamic, setLocalDynamic] = useState('');

  // Sync node data to local state
  useEffect(() => {
    const rawValue = node?.data?.skillIds || [];
    const skillIds = Array.isArray(rawValue) ? rawValue : [rawValue];

    // Simple heuristic: if it contains {{ it's dynamic
    const fixed = skillIds.filter((id) => !id.includes('{{'));
    const dynamic = skillIds.filter((id) => id.includes('{{')).join(', ');

    setLocalFixed(fixed);
    setLocalDynamic(dynamic);
  }, [node.id]);

  const updateParentSkillIds = (fixed, dynamic) => {
    const dynamicList = dynamic
      ? dynamic
          .split(/[\|,]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const newValue = [...fixed, ...dynamicList];

    setNodes((nds) =>
      nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, skillIds: newValue } } : n)),
    );
  };

  const handleFixedChange = (vals) => {
    setLocalFixed(vals);
    updateParentSkillIds(vals, localDynamic);
  };

  const handleDynamicChange = (val) => {
    setLocalDynamic(val);
    updateParentSkillIds(localFixed, val);
  };

  return (
    <NodePropertyCollapse node={node} setNodes={setNodes}>
      <Form.Item
        label={t('workflow.designer.staticSkills', 'Standard Skills')}
        extra={t(
          'workflow.designer.staticSkillsHelp',
          'Hierarchical picker with collapsible groups',
        )}
      >
        <SkillSelector appId={appId} value={localFixed} onChange={handleFixedChange} />
      </Form.Item>

      <Divider style={{ margin: '16px 0' }} />

      <Form.Item
        label={t('workflow.designer.dynamicSkills', 'Variable / Custom Expressions')}
        extra={t(
          'workflow.designer.dynamicSkillsHelp',
          'Use commas or | to separate multiple items, e.g., doc:{{trigger.docId}} | pkg:custom-tool',
        )}
      >
        <VariableInput
          value={localDynamic}
          onChange={handleDynamicChange}
          currentNodeId={currentNodeId || node?.id}
          placeholder="e.g., doc:{{trigger.docId}}"
          rows={2}
          mode="preview"
        />
      </Form.Item>
    </NodePropertyCollapse>
  );
};

export default SkillNodeProperties;
