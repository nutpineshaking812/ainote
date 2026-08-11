import React, { useState, useEffect } from 'react';
import { Form, Spin, Empty, Alert, Typography, Tag, Space } from 'antd';
import {
  NodeIndexOutlined,
  ArrowRightOutlined,
  RocketOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { getWorkflowInterface } from '../../../../api/workflow';
import VariableInput from './VariableInput';

const { Text } = Typography;

const SubworkflowParamsEditor = ({ node, setNodes, currentNodeId }) => {
  const form = Form.useFormInstance();
  // Watch the workflowId field under pluginParams
  const workflowId = Form.useWatch(['pluginParams', 'workflowId'], form);

  const [contract, setContract] = useState(null); // { inputs: [], outputs: [] }
  const [loadingDef, setLoadingDef] = useState(false);

  useEffect(() => {
    if (!workflowId) {
      setContract(null);
      return;
    }

    const fetchContract = async () => {
      setLoadingDef(true);
      try {
        const res = await getWorkflowInterface(workflowId);
        setContract(res.data || res);
      } catch (e) {
        console.error('Failed to load sub-workflow contract', e);
        setContract(null);
      } finally {
        setLoadingDef(false);
      }
    };
    fetchContract();
  }, [workflowId]);

  const inputs = contract?.inputs || [];
  const outputs = contract?.outputs || [];

  // Sync outputs to current node so downstream variable selectors can use them
  useEffect(() => {
    if (outputs.length > 0 && setNodes && node?.id) {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === node.id) {
            const currentOutputs = n.data.outputs || [];
            if (JSON.stringify(currentOutputs) !== JSON.stringify(outputs)) {
              return { ...n, data: { ...n.data, outputs } };
            }
          }
          return n;
        })
      );
    }
  }, [JSON.stringify(outputs), node?.id, setNodes]);

  if (loadingDef) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <Spin size="small" tip="正在同步契约..." />
      </div>
    );
  }

  if (!workflowId) {
    return (
      <Alert
        type="warning"
        showIcon
        icon={<ExclamationCircleOutlined style={{ fontSize: 12 }} />}
        message={<span style={{ fontSize: 11 }}>请先选择子工作流以同步其输入契约。</span>}
      />
    );
  }

  if (!contract) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无法解析目标工作流契约" />;
  }

  return (
    <div style={{ padding: '4px 0' }}>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {/* 输入参数 (Inputs) */}
        <div className="schema-section">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 6 }}>
            <RocketOutlined style={{ color: '#1677ff' }} />
            <Text strong style={{ fontSize: 13 }}>
              输入参数 (Inputs)
            </Text>
          </div>

          {inputs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {inputs.map((param) => (
                <div key={param.name}>
                  <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12 }}>
                      {param.name} {param.required && <span style={{ color: '#ff4d4f' }}>*</span>}
                    </Text>
                    <Tag style={{ fontSize: 10, margin: 0 }}>{param.type?.toUpperCase()}</Tag>
                  </div>
                  <Form.Item
                    name={['pluginParams', 'inputData', param.name]}
                    noStyle
                    rules={param.required ? [{ required: true, message: '请输入值' }] : []}
                  >
                    <VariableInput
                      placeholder={param.description || `请输入 ${param.name}`}
                      currentNodeId={currentNodeId || node?.id}
                      size="small"
                    />
                  </Form.Item>
                </div>
              ))}
            </div>
          ) : (
            <Alert
              type="info"
              showIcon
              icon={<ExclamationCircleOutlined style={{ fontSize: 12 }} />}
              message={<span style={{ fontSize: 11 }}>该子流没有定义入参。</span>}
            />
          )}
        </div>

        {/* 输出结果 (Outputs) */}
        <div className="schema-section" style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 6 }}>
            <NodeIndexOutlined style={{ color: '#52c41a' }} />
            <Text strong style={{ fontSize: 13 }}>
              输出结果 (Outputs)
            </Text>
          </div>
          {outputs.length > 0 ? (
            <div
              style={{
                background: '#f6ffed',
                border: '1px solid #b7eb8f',
                borderRadius: 4,
                padding: '8px 12px',
              }}
            >
              <Space wrap size={[8, 12]}>
                {outputs.map((out) => (
                  <div
                    key={out.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#fff',
                      border: '1px solid #d9f7be',
                      borderRadius: 4,
                      padding: '2px 8px',
                    }}
                  >
                    <ArrowRightOutlined style={{ fontSize: 10, color: '#52c41a' }} />
                    <Text style={{ fontSize: 12, fontWeight: 500 }}>{out.name}</Text>
                    <Text type="secondary" style={{ fontSize: 10, fontStyle: 'italic' }}>
                      ({out.type || 'string'})
                    </Text>
                  </div>
                ))}
              </Space>
            </div>
          ) : (
            <Text type="secondary" style={{ fontSize: 11, paddingLeft: 22 }}>
              无显式定义。
            </Text>
          )}
        </div>
      </Space>

      <style>{`
        .schema-section {
          background: #fcfcfc;
          border: 1px solid #f0f0f0;
          border-radius: 6px;
          padding: 10px;
        }
      `}</style>
    </div>
  );
};

export default SubworkflowParamsEditor;
