import React, { useState, useEffect, useMemo } from 'react';
import { TreeSelect, Typography, Tag, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getSkills } from '../../../../api/workflow';

const { Text } = Typography;

// 根据 inputSchema 渲染参数列表
const SchemaParamsPanel = ({ skill }) => {
  const schema = skill?.inputSchema;
  if (!schema) return null;

  const props = schema.properties || (typeof schema === 'object' ? schema : null);
  if (!props || Object.keys(props).length === 0) return null;

  const required = schema.required || [];

  return (
    <div
      style={{
        marginTop: 6,
        padding: '8px 10px',
        background: '#f6ffed',
        border: '1px solid #b7eb8f',
        borderRadius: 6,
        fontSize: 12,
      }}
    >
      <Text style={{ fontSize: 11, color: '#52c41a', fontWeight: 600 }}>
        参数说明 · {skill.name}
      </Text>
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {Object.entries(props).map(([key, def]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <Text code style={{ fontSize: 11, flexShrink: 0 }}>
              {key}
            </Text>
            {required.includes(key) && (
              <Tag color="red" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', height: 16, flexShrink: 0 }}>
                必填
              </Tag>
            )}
            <Tag color="blue" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', height: 16, flexShrink: 0 }}>
              {def.type || 'any'}
            </Tag>
            {def.description && (
              <Text type="secondary" style={{ fontSize: 11, lineHeight: '16px' }}>
                {def.description}
              </Text>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const SkillSelector = ({ value, onChange, onSkillChange, appId, ...props }) => {
  const { t } = useTranslation();
  const [availableSkills, setAvailableSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(null);

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

  // 初始化时，若已有 value，尝试匹配已选技能（用于表单回显）
  useEffect(() => {
    if (!isMultiple && value && availableSkills.length > 0) {
      const matched = availableSkills.find(
        (s) => String(s.id) === String(value) || s.name === value,
      );
      setSelectedSkill(matched || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const isMultiple = props.multiple !== false;
  const isTreeCheckable = props.treeCheckable !== false;

  const handleChange = (newValue) => {
    onChange?.(newValue);
    // 单选时，匹配并保存选中的 skill 定义（含 inputSchema）
    if (!isMultiple) {
      const matched = availableSkills.find(
        (s) => String(s.id) === String(newValue) || s.name === newValue,
      );
      setSelectedSkill(matched || null);
      onSkillChange?.(matched || null);
    }
  };

  return (
    <div>
      <TreeSelect
        {...props}
        treeData={treeData}
        value={value}
        onChange={handleChange}
        treeCheckable={isTreeCheckable}
        showCheckedStrategy={TreeSelect.SHOW_PARENT}
        placeholder={t('workflow.designer.selectSkills', 'Search or pick skills')}
        style={{ width: '100%', ...props.style }}
        dropdownStyle={{ maxHeight: 600, overflow: 'auto', zIndex: 1060 }}
        multiple={isMultiple}
        loading={loading}
        treeNodeFilterProp="title"
        allowClear
      />
      {/* 单选模式下选中后展示参数 Schema */}
      {!isMultiple && selectedSkill && <SchemaParamsPanel skill={selectedSkill} />}
    </div>
  );
};

export default SkillSelector;
