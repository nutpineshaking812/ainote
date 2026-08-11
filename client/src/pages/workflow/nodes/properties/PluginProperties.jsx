import React, { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Switch, Typography, Select, Alert, Divider } from 'antd';
import { getPlugins } from '../../../../api/plugins';
import NodePropertyCollapse from './NodePropertyCollapse';
import { PROPERTY_INPUTS_REGISTRY } from '../../components/PropertyInputs';
import { isTauri } from '../../../../utils/platform';

const { Text } = Typography;

const PluginProperties = ({ node, setNodes, currentNodeId, appId }) => {
  const VariableInput = PROPERTY_INPUTS_REGISTRY.variableInput;
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(false);
  const form = Form.useFormInstance();

  // 🌟 Legacy Migration logic for ensureConvo
  useEffect(() => {
    if (node?.type === 'ensureConvo' && !node.data?.pluginId) {
      if (typeof setNodes === 'function') {
        setNodes((prevNodes) =>
          prevNodes.map((n) => {
            if (n.id === node.id) {
              return {
                ...n,
                data: {
                  ...n.data,
                  pluginId: 'ensureConvo',
                  pluginParams: {
                    conversationId: n.data.conversationId,
                    scenario: n.data.scenario || n.data.type || 'GENERAL',
                    initialMessage: n.data.message || n.data.initialMessage,
                    targetId: n.data.targetId,
                    employeeId: n.data.employeeId,
                  },
                },
              };
            }
            return n;
          }),
        );
      }
    }
  }, [node, setNodes]);

  useEffect(() => {
    const fetchManifest = async () => {
      const targetPluginId =
        node.data?.pluginId || (node.type === 'ensureConvo' ? 'ensureConvo' : null);
      if (!targetPluginId) return;
      setLoading(true);
      try {
        const data = await getPlugins();
        const currentPlugin = data.find((p) => p.id === targetPluginId);
        if (currentPlugin) {
          setManifest(currentPlugin);
        }
      } catch (err) {
        console.error('Failed to load plugin manifest', err);
      } finally {
        setLoading(false);
      }
    };
    fetchManifest();
  }, [node.data?.pluginId, node.type]);

  const checkVisibility = (visibleExpr, values) => {
    if (!visibleExpr) return true;
    try {
      const keys = Object.keys(values || {});
      const f = new Function(...keys, `return ${visibleExpr}`);
      return f(...keys.map((k) => values[k]));
    } catch (e) {
      return true;
    }
  };

  if (loading) return <div style={{ padding: 20 }}>正在加载插件定义...</div>;
  if (!manifest) return <Alert message="无法加载插件定义" type="error" />;

  return (
    <NodePropertyCollapse node={node} setNodes={setNodes}>
      {/* Natively register aiMeta as a hidden Form.Item to participate in the AntD Form store */}
      <Form.Item name={['pluginParams', 'aiMeta']} noStyle>
        <Input type="hidden" />
      </Form.Item>
      {manifest.properties
        .filter((field) => {
          if (field.type === 'workspacePath' && !isTauri) return false;
          return true;
        })
        .map((field) => (
          <Form.Item
            key={field.name}
            noStyle
            shouldUpdate={(prev, curr) =>
              JSON.stringify(prev.pluginParams?.[field.name]) !==
              JSON.stringify(curr.pluginParams?.[field.name])
            }
          >
            {({ getFieldValue }) => {
              const pluginParams = getFieldValue('pluginParams') || {};
              if (!checkVisibility(field.visible, pluginParams)) return null;

              const CustomInput = PROPERTY_INPUTS_REGISTRY[field.type];

              return (
              <Form.Item
                name={['pluginParams', field.name]}
                label={
                  <Text strong style={{ fontSize: 12 }}>
                    {field.label}
                  </Text>
                }
                tooltip={field.description}
                required={field.required}
                initialValue={field.default}
              >
                {CustomInput ? (
                  (() => {
                    // For JS editor fields, wire aiMeta persistence into the node directly
                    const isCodeField = field.type === 'code' || field.type === 'javascript';
                    const aiMetaProps = isCodeField
                      ? {
                          aiMeta: node?.data?.pluginParams?.aiMeta || {},
                          onAiMetaChange: (meta) => {

                            // 1. Sync React Flow state
                            if (typeof setNodes === 'function') {
                              setNodes((prev) =>
                                prev.map((n) => {
                                  if (n.id === node.id) {
                                    const nextNode = {
                                      ...n,
                                      data: {
                                        ...n.data,
                                        pluginParams: { ...n.data.pluginParams, aiMeta: meta },
                                      },
                                    };
                                    return nextNode;
                                  }
                                  return n;
                                }),
                              );
                            }

                            // 2. Sync Ant Design Form store
                            if (form) {
                              const currentParams = form.getFieldValue('pluginParams') || {};
                              form.setFieldsValue({
                                pluginParams: {
                                  ...currentParams,
                                  aiMeta: meta,
                                },
                              });
                            }
                          },
                        }
                      : {};
                    return (
                      <CustomInput
                        placeholder={field.placeholder}
                        appId={appId}
                        node={node}
                        setNodes={setNodes}
                        currentNodeId={currentNodeId || node?.id}
                        {...(field.props || {})}
                        {...aiMetaProps}
                      />
                    );
                  })()
                ) : field.type === 'number' ? (
                  <InputNumber style={{ width: '100%' }} />
                ) : field.type === 'switch' ? (
                  <Switch size="small" />
                ) : field.type === 'select' ? (
                  <Select
                    options={field.options}
                    placeholder={field.placeholder}
                    style={{ width: '100%' }}
                  />
                ) : (
                  <VariableInput
                    mode="preview"
                    currentNodeId={currentNodeId || node?.id}
                    rows={field.type === 'textarea' ? 4 : undefined}
                    placeholder={field.placeholder}
                  />
                )}
              </Form.Item>
            );
          }}
        </Form.Item>
      ))}

      {manifest.outputs && manifest.outputs.length > 0 && (
        <div
          style={{
            marginTop: 24,
            padding: '12px',
            background: '#fafafa',
            borderRadius: 8,
            border: '1px solid #f0f0f0',
          }}
        >
          <Text strong style={{ fontSize: 12 }}>
            节点输出参考
          </Text>
          {manifest.outputs.map((out) => (
            <div key={out.name} style={{ display: 'flex', gap: 8, fontSize: 11, marginTop: 4 }}>
              <Text type="secondary">{out.label}:</Text>
              <Text code>{`{{${node.id}.${out.name}}}`}</Text>
            </div>
          ))}
        </div>
      )}
    </NodePropertyCollapse>
  );
};

export default PluginProperties;
