import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Form, Select, Button, Tooltip, Space, Switch } from 'antd';
import {
  RobotOutlined,
  ThunderboltOutlined,
  CodeOutlined,
  BulbOutlined,
  SearchOutlined,
  CompressOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import NodePropertyCollapse from './NodePropertyCollapse';
import AIPromptManager from '../../../../components/AIPromptManager';
import { useWorkflow } from '../../context/WorkflowContext';
import { PROPERTY_INPUTS_REGISTRY } from '../../components/PropertyInputs';
import { getAvailableModels } from '../../../../api/ai';

const AIAgentProperties = ({ node, setNodes, appId }) => {
  const { t } = useTranslation();
  const LLMModelSelector = PROPERTY_INPUTS_REGISTRY.model;
  const VariableInput = PROPERTY_INPUTS_REGISTRY.variableInput;
  const { nodes, edges } = useWorkflow();
  const systemPromptRef = useRef(null);
  const userPromptRef = useRef(null);
  const activeInputRef = useRef('prompt'); // Default to system prompt

  // State for AI Models from API (used for logic check)
  const [providers, setProviders] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Prompt Manager state
  const [promptManagerOpen, setPromptManagerOpen] = useState(false);

  // Calculate inherited skills from connected SkillNodes
  const inheritedSkillDetails = useMemo(() => {
    const incomingEdges = edges.filter((e) => e.target === node.id);
    const sourceNodes = incomingEdges
      .map((e) => nodes.find((n) => n.id === e.source))
      .filter((n) => n && n.type === 'skillNode');

    const skillIds = [];
    sourceNodes.forEach((sn) => {
      const ids = sn.data?.skillIds;
      if (Array.isArray(ids)) {
        ids.forEach((id) => {
          if (!skillIds.includes(id)) skillIds.push(id);
        });
      } else if (typeof ids === 'string' && ids.trim().length > 0) {
        if (!skillIds.includes(ids)) skillIds.push(ids);
      }
    });
    return { count: skillIds.length, nodeCount: sourceNodes.length };
  }, [node.id, nodes, edges]);

  useEffect(() => {
    const fetchModels = async () => {
      setLoadingModels(true);
      try {
        const data = await getAvailableModels();
        setProviders(data || []);
      } catch (e) {
        console.error('Failed to fetch AI models', e);
      } finally {
        setLoadingModels(false);
      }
    };

    fetchModels();
  }, [appId]);

  const handlePromptSelect = (template) => {
    const targetRef = activeInputRef.current === 'userPrompt' ? userPromptRef : systemPromptRef;
    if (targetRef.current) {
      targetRef.current.insertText(template.textContent || template.contentPlain || '');
    }
  };

  const openPromptLibrary = (field) => {
    activeInputRef.current = field;
    setPromptManagerOpen(true);
  };

  return (
    <NodePropertyCollapse node={node} setNodes={setNodes}>
      <Form.Item
        label={t('workflow.designer.systemPrompt', 'System Prompt')}
        name="prompt"
        required
      >
        <VariableInput
          ref={systemPromptRef}
          mode="preview"
          rows={3}
          currentNodeId={node.id}
          placeholder={t(
            'workflow.designer.systemPromptPlaceholder',
            "Describe the assistant's personality and rules",
          )}
          extra={
            <Tooltip title={t('workflow.designer.openPromptLibrary', 'AI Prompt Library')}>
              <Button
                size="small"
                type="text"
                icon={<RobotOutlined style={{ fontSize: 14, color: '#8c8c8c' }} />}
                onClick={() => openPromptLibrary('prompt')}
                style={{
                  background: '#f5f5f5',
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </Tooltip>
          }
        />
      </Form.Item>

      <Form.Item label={t('workflow.designer.userPrompt', 'User Prompt')} name="userPrompt">
        <VariableInput
          ref={userPromptRef}
          mode="preview"
          currentNodeId={node.id}
          placeholder={t(
            'workflow.designer.userPromptPlaceholder',
            'Instructions or questions from the user',
          )}
          extra={
            <Tooltip title={t('workflow.designer.openPromptLibrary', 'AI Prompt Library')}>
              <Button
                size="small"
                type="text"
                icon={<RobotOutlined style={{ fontSize: 14, color: '#8c8c8c' }} />}
                onClick={() => openPromptLibrary('userPrompt')}
                style={{
                  background: '#f5f5f5',
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </Tooltip>
          }
        />
      </Form.Item>

      <AIPromptManager
        open={promptManagerOpen}
        onClose={() => setPromptManagerOpen(false)}
        onSelect={handlePromptSelect}
        defaultOnlyApp={false}
      />

      <Form.Item label={t('workflow.designer.model')} name="model">
        <LLMModelSelector />
      </Form.Item>

      {/* Reactive Form Segment */}
      <Form.Item noStyle shouldUpdate={(prev, curr) => prev.model !== curr.model}>
        {({ getFieldValue }) => {
          const selectedModel = getFieldValue('model') || '';
          // Check if it's a Qwen model by prefix or by looking up provider
          const isQwenProvider =
            selectedModel.startsWith('qwen') ||
            providers.find((p) => p.id === 'qwen')?.models?.includes(selectedModel);

          return (
            <>
              <Form.Item
                label={
                  <Space size={4}>
                    <CodeOutlined />
                    {t('workflow.designer.jsonMode', 'JSON 输出模式')}
                  </Space>
                }
                name="jsonMode"
                valuePropName="checked"
                tooltip={t(
                  'workflow.designer.jsonModeTip',
                  '开启后，模型将被强制要求以合法 JSON 格式返回结果（需在 Prompt 中说明 JSON 结构）',
                )}
              >
                <Switch size="small" />
              </Form.Item>

              <Form.Item
                label={
                  <Space size={4}>
                    <BulbOutlined />
                    {t('workflow.designer.enableThinking', '深度思考模式')}
                  </Space>
                }
                name="enableThinking"
                valuePropName="checked"
                tooltip={t(
                  'workflow.designer.enableThinkingTip',
                  '开启后，Qwen / DeepSeek 等支持思维链的模型将进行内部推理',
                )}
              >
                <Switch size="small" />
              </Form.Item>

              {isQwenProvider && (
                <Form.Item
                  label={
                    <Space size={4}>
                      <SearchOutlined />
                      {t('workflow.designer.enableSearch', '联网搜索模式')}
                    </Space>
                  }
                  name="enableSearch"
                  valuePropName="checked"
                  tooltip={t(
                    'workflow.designer.enableSearchTip',
                    '仅支持 Qwen。开启后，模型在回答时可自动调用联网搜索增强实时信息获取能力',
                  )}
                >
                  <Switch size="small" />
                </Form.Item>
              )}
            </>
          );
        }}
      </Form.Item>

      <Form.Item
        label={
          <Space size={4}>
            <ThunderboltOutlined />
            {t('workflow.designer.toolChoice', '工具调用策略')}
          </Space>
        }
        name="toolChoice"
        tooltip={t(
          'workflow.designer.toolChoiceTip',
          '控制 AI 如何选择工具：auto (自动), required (强制至少调用一个), none (禁用工具)',
        )}
      >
        <Select size="small" style={{ width: '100%' }}>
          <Select.Option value="auto">
            {t('workflow.designer.toolChoiceAuto', 'Auto (自动)')}
          </Select.Option>
          <Select.Option value="required">
            {t('workflow.designer.toolChoiceRequired', 'Required (强制调用)')}
          </Select.Option>
          <Select.Option value="none">
            {t('workflow.designer.toolChoiceNone', 'None (禁用工具)')}
          </Select.Option>
        </Select>
      </Form.Item>

      <Form.Item
        label={
          <Space size={4}>
            <CompressOutlined />
            {t('workflow.designer.outputMode', '输出模式')}
          </Space>
        }
        name="outputMode"
        tooltip={t(
          'workflow.designer.outputModeTip',
          '完整输出：实时推送工具参数流（tool-input-delta）；精简输出：跳过参数流，仅推送工具开始/结束事件；静音模式：完全不向前端推送执行过程与结果，也不记录到会话历史。',
        )}
      >
        <Select size="small" style={{ width: '100%' }}>
          <Select.Option value="full">
            {t('workflow.designer.outputModeFull', '完整输出（含参数流）')}
          </Select.Option>
          <Select.Option value="compact">
            {t('workflow.designer.outputModeCompact', '精简输出（跳过参数流）')}
          </Select.Option>
          <Select.Option value="silent">
            {t('workflow.designer.outputModeSilent', '静音模式（隐藏过程内容）')}
          </Select.Option>
        </Select>
      </Form.Item>

      <Form.Item noStyle shouldUpdate={(prev, curr) => prev.outputMode !== curr.outputMode}>
        {({ getFieldValue }) =>
          getFieldValue('outputMode') === 'silent' && (
            <Form.Item
              label={t('workflow.designer.silentText', '静默提示文案')}
              name="silentText"
              tooltip={t(
                'workflow.designer.silentTextTip',
                '开启静音模式后，前端气泡将显示此固定文案，而非 AI 的真实输出内容（真实内容将标记为隐藏，仅供 AI 记忆参考）。',
              )}
            >
              <VariableInput
                currentNodeId={node.id}
                placeholder={t('workflow.designer.silentTextPlaceholder', '例如：正在为您处理数据...')}
                size="small"
              />
            </Form.Item>
          )
        }
      </Form.Item>

      <Form.Item label={t('workflow.designer.skills', 'AI Skills')}>
        {inheritedSkillDetails.count > 0 ? (
          <div
            style={{
              padding: '8px 12px',
              background: '#f9f0ff',
              border: '1px solid #d3adf7',
              borderRadius: '6px',
              fontSize: '12px',
            }}
          >
            <Space align="start">
              <ThunderboltOutlined style={{ color: '#722ed1', marginTop: 2 }} />
              <div>
                <div style={{ color: '#722ed1', fontWeight: 600, marginBottom: 2 }}>
                  {t('workflow.designer.inheritedSkillsTitle', 'Inherited Capabilities')}
                </div>
                <div style={{ color: '#595959' }}>
                  {t(
                    'workflow.designer.inheritedSkillsTip',
                    '{{count}} skills inherited from {{nodeCount}} connected Skill Spheres',
                    {
                      count: inheritedSkillDetails.count,
                      nodeCount: inheritedSkillDetails.nodeCount,
                    },
                  )}
                </div>
              </div>
            </Space>
          </div>
        ) : (
          <div
            style={{
              padding: '12px',
              background: '#fafafa',
              border: '1px dashed #d9d9d9',
              borderRadius: '6px',
              textAlign: 'center',
            }}
          >
            <Space direction="vertical" size={4}>
              <ThunderboltOutlined style={{ color: '#bfbfbf', fontSize: '20px' }} />
              <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                {t(
                  'workflow.designer.noSkillsTip',
                  'No skills connected. Plug in a Skill Sphere below to add capabilities.',
                )}
              </div>
            </Space>
          </div>
        )}
      </Form.Item>
    </NodePropertyCollapse>
  );
};

export default AIAgentProperties;
