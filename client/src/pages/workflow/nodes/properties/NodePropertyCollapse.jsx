import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Collapse, Form, Switch, Typography, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import NodeOutputView from './NodeOutputView';
import VariableInput from '../../components/PropertyInputs/VariableInput';

const { Text } = Typography;

const NodePropertyCollapse = ({
  node,
  setNodes,
  children,
  hideOutput = false,
  hideSettings = false,
  onValuesChange,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [activeKeys, setActiveKeys] = useState(['settings', 'output']);

  // Update form values when node changes
  useEffect(() => {
    form.setFieldsValue(node.data);
  }, [node.data, form]);

  const updateNodes = useCallback((values) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === node.id) {
          const mergedPluginParams = values.pluginParams
            ? { ...(n.data?.pluginParams || {}), ...values.pluginParams }
            : undefined;
          const nextNode = {
            ...n,
            data: {
              ...n.data,
              ...values,
              ...(mergedPluginParams ? { pluginParams: mergedPluginParams } : {}),
            },
          };
          return nextNode;
        }
        return n;
      }),
    );
  }, [node.id, setNodes]);

  const defaultHandleValuesChange = useCallback((changedValues, allValues) => {
    // 🛡️ 智能便捷体验：当用户开启 mock 开关时，若之前有真实运行数据，自动将解析后的最后一次运行结果填入 mockData 中
    if ('isMock' in changedValues && changedValues.isMock === true) {
      const lastResult = node.data?.lastResult;
      let finalResult = lastResult;
      if (
        lastResult &&
        typeof lastResult === 'object' &&
        'resolvedConfig' in lastResult &&
        'result' in lastResult
      ) {
        finalResult = lastResult.result;
      }

      if (finalResult !== undefined && finalResult !== null && !allValues.mockData) {
        const mockJson = typeof finalResult === 'object'
          ? JSON.stringify(finalResult, null, 2)
          : String(finalResult);

        allValues.mockData = mockJson;
        form.setFieldsValue({ mockData: mockJson });
      }
    }

    if (onValuesChange) {
      onValuesChange(allValues, (normalizedValues) => {
        updateNodes(normalizedValues);
      });
    } else {
      updateNodes(allValues);
    }
  }, [onValuesChange, updateNodes, node.data, form]);

  const items = useMemo(() => {
    const list = [];

    if (!hideSettings) {
      list.push({
        key: 'settings',
        label: t('workflow.designer.tabConfig', 'Settings'),
        children: (
          <Form
            form={form}
            layout="vertical"
            onValuesChange={defaultHandleValuesChange}
            requiredMark="optional"
            style={{ padding: '0 4px 16px' }}
            preserve={true}
          >
            {children}

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Text strong style={{ fontSize: '13px' }}>
                    {t('workflow.designer.mockTitle', 'Debug / Mock')}
                  </Text>
                  <Form.Item name="isMock" valuePropName="checked" noStyle>
                    <Switch size="small" />
                  </Form.Item>
                </div>

                <Form.Item
                  noStyle
                  shouldUpdate={(prevValues, currentValues) =>
                    prevValues.isMock !== currentValues.isMock
                  }
                >
                  {({ getFieldValue }) =>
                    getFieldValue('isMock') && (
                      <Form.Item
                        name="mockData"
                        label={
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {t(
                              'workflow.designer.mockDataLabel',
                              'Mock Output Data (JSON or String)',
                            )}
                          </Text>
                        }
                        extra={t(
                          'workflow.designer.mockDataHelp',
                          'Subsequent nodes will receive this as output.',
                        )}
                      >
                        <VariableInput
                          mode="preview"
                          rows={4}
                          placeholder='{"success": true}'
                          style={{ fontSize: '12px' }}
                        />
                      </Form.Item>
                    )
                  }
                </Form.Item>
              </Space>
            </div>
          </Form>
        ),
      });
    }

    if (!hideOutput) {
      list.push({
        key: 'output',
        label: t('workflow.designer.tabOutput', 'Output'),
        children: (
          <div style={{ padding: '0 4px 16px' }}>
            <NodeOutputView node={node} />
          </div>
        ),
      });
    }
    return list;
  }, [hideSettings, hideOutput, t, form, defaultHandleValuesChange, children, node]);

  return (
    <Collapse
      activeKey={activeKeys}
      onChange={setActiveKeys}
      bordered={false}
      items={items}
      expandIconPosition="end"
      style={{ padding: '0 8px' }}
    />
  );
};

export default NodePropertyCollapse;
