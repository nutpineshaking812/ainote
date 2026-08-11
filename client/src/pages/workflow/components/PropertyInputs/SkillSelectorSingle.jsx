import React, { useState, useEffect, useMemo } from 'react';
import { TreeSelect, Typography, Tag, Tooltip, Form, Divider } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getSkills } from '../../../../api/workflow';
import VariableInput from './VariableInput';

const { Text } = Typography;

const SkillSelectorSingle = ({ value, onChange, appId, currentNodeId, ...props }) => {
  const { t } = useTranslation();
  const [availableSkills, setAvailableSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(null);

  const form = Form.useFormInstance();
  const args = Form.useWatch(['pluginParams', 'args'], form) || {};

  useEffect(() => {
    const fetchSkills = async () => {
      setLoading(true);
      try {
        const res = await getSkills(appId);
        setAvailableSkills(res || []);
      } catch (e) {
        console.error('Failed to fetch skills', e);
      } finally {
        setLoading(false);
      }
    };
    fetchSkills();
  }, [appId]);

  // Sync selected skill details when value changes
  useEffect(() => {
    if (value && availableSkills.length > 0) {
      const matched = availableSkills.find(
        (s) => String(s.id) === String(value) || s.name === value,
      );
      setSelectedSkill(matched || null);
    } else {
      setSelectedSkill(null);
    }
  }, [value, availableSkills]);

  const treeData = useMemo(() => {
    const mcpSkills = availableSkills.filter((s) => s.type === 'MCP');
    const mcpGroups = {};
    mcpSkills.forEach((s) => {
      const parts = s.id.split(':');
      const serverId = s.mcpServerId || parts[1];
      const serverName = (s.label || '').split(':')[0] || serverId;
      if (!mcpGroups[serverId]) mcpGroups[serverId] = { name: serverName, tools: [] };
      mcpGroups[serverId].tools.push(s);
    });

    return [
      {
        title: t('workflow.designer.systemSkills', 'System Capabilities'),
        value: 'group:system',
        key: 'group:system',
        selectable: false,
        checkable: false,
        children: availableSkills
          .filter((s) => s.type === 'CODE')
          .map((s) => ({ title: s.name, value: s.id, key: s.id })),
      },
      {
        title: t('workflow.designer.workflowSkills', 'Organization Workflows'),
        value: 'group:workflow',
        key: 'group:workflow',
        selectable: false,
        checkable: false,
        children: availableSkills
          .filter((s) => s.type === 'WORKFLOW')
          .map((s) => ({ title: s.name, value: s.id, key: s.id })),
      },
      {
        title: t('workflow.designer.documentSkills', 'Document Libraries (RAG)'),
        value: 'group:document',
        key: 'group:document',
        selectable: false,
        checkable: false,
        children: availableSkills
          .filter((s) => s.type === 'DOCUMENT')
          .map((s) => ({ title: s.name, value: s.id, key: s.id })),
      },
      {
        title: t('workflow.designer.mcpSkills', 'External Plugins (MCP)'),
        value: 'group:mcp',
        key: 'group:mcp',
        selectable: false,
        checkable: false,
        children: Object.entries(mcpGroups).map(([serverId, group]) => ({
          title: group.name,
          value: `mcp:${serverId}:*`,
          key: `mcp:${serverId}:*`,
          children: group.tools.map((tool) => ({
            title: tool.label || tool.name,
            value: tool.id,
            key: tool.id,
          })),
        })),
      },
      {
        title: t('workflow.designer.packageSkills', 'Package Skills'),
        value: 'group:package',
        key: 'group:package',
        selectable: false,
        checkable: false,
        children: availableSkills
          .filter((s) => s.type === 'PACKAGE_SKILL')
          .map((s) => ({ title: s.label || s.name, value: s.id, key: s.id })),
      },
    ].filter((category) => category.children && category.children.length > 0);
  }, [availableSkills, t]);

  const handleSkillSelect = (newSkillId) => {
    onChange?.(newSkillId);
    // Reset args for the new skill selection
    if (form) {
      form.setFieldValue(['pluginParams', 'args'], {});
    }
  };

  const schema = selectedSkill?.inputSchema;
  const properties = schema?.properties || {};
  const required = schema?.required || [];

  return (
    <div>
      <TreeSelect
        {...props}
        treeData={treeData}
        value={value}
        onChange={handleSkillSelect}
        treeCheckable={false}
        placeholder={t('workflow.designer.selectSkills', 'Search or pick a skill')}
        style={{ width: '100%' }}
        dropdownStyle={{ maxHeight: 600, overflow: 'auto', zIndex: 1060 }}
        loading={loading}
        treeNodeFilterProp="title"
        allowClear
      />

      {selectedSkill && Object.keys(properties).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Divider orientation="left" style={{ margin: '8px 0', fontSize: 12, color: '#8c8c8c' }}>
            {t('workflow.nodes.skill.inputParams', 'Parameter Bindings')}
          </Divider>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(properties).map(([key, def]) => {
              const val = args[key] ?? '';
              return (
                <div key={key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Text strong style={{ fontSize: 12 }}>
                      {key}
                    </Text>
                    {required.includes(key) && (
                      <span style={{ color: '#ff4d4f', fontSize: 12 }}>*</span>
                    )}
                    <Tag color="blue" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', height: 16 }}>
                      {def.type || 'string'}
                    </Tag>
                    {def.description && (
                      <Tooltip title={def.description}>
                        <InfoCircleOutlined style={{ fontSize: 12, color: '#bfbfbf', cursor: 'help' }} />
                      </Tooltip>
                    )}
                  </div>
                  <VariableInput
                    value={val}
                    onChange={(newVal) => {
                      const nextArgs = { ...args, [key]: newVal };
                      form.setFieldValue(['pluginParams', 'args'], nextArgs);
                    }}
                    currentNodeId={currentNodeId}
                    placeholder={def.description || `Enter ${key}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillSelectorSingle;
