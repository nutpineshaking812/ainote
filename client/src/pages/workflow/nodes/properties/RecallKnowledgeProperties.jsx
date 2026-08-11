import React, { useState, useEffect } from 'react';
import { Form, Select, Typography, Tag, Alert } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import NodePropertyCollapse from './NodePropertyCollapse';
import { getWorkflows } from '../../../../api/workflow';

const { Text } = Typography;

const RecallKnowledgeProperties = ({ node, setNodes, appId }) => {
  const { t } = useTranslation();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await getWorkflows({ appId, includeSystem: true });
        setWorkflows(res || []);
      } catch (e) {
        console.error('Failed to load workflows', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [appId]);

  // Split workflows by category for grouped display
  const recallWorkflows = workflows.filter((w) => w.category === 'AI_MEMORY_RECALL');
  const generalWorkflows = workflows.filter((w) => !w.category || w.category === 'GENERAL');

  return (
    <NodePropertyCollapse node={node} setNodes={setNodes}>
      {/* Header hint */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          background: '#fff7e6',
          border: '1px solid #ffd591',
          borderRadius: 8,
          padding: '10px 12px',
          marginBottom: 16,
        }}
      >
        <DatabaseOutlined style={{ color: '#fa8c16', fontSize: 16, marginTop: 2 }} />
        <div>
          <Text strong style={{ fontSize: 12, color: '#d46b08', display: 'block' }}>
            {t('workflow.nodes.recallKnowledge.title', '加载知识')}
          </Text>
          <Text style={{ fontSize: 11, color: '#614700' }}>
            选择一个专门负责检索记忆的工作流。AI 在推理过程中会动态调用它来获取相关知识。
          </Text>
        </div>
      </div>

      <Form.Item
        label={t('workflow.nodes.recallKnowledge.workflowId', '召回工作流')}
        name="workflowId"
        rules={[{ required: true, message: '请选择召回工作流' }]}
        extra={
          recallWorkflows.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 11 }}>
              提示：将工作流的分类设为「AI_MEMORY_RECALL」，它会出现在推荐列表中。
            </Text>
          ) : null
        }
      >
        <Select
          loading={loading}
          placeholder="请选择召回策略工作流"
          showSearch
          optionFilterProp="label"
          allowClear
          options={[
            ...(recallWorkflows.length > 0
              ? [
                  {
                    label: (
                      <span>
                        推荐：记忆召回策略{' '}
                        <Tag color="orange" style={{ fontSize: 10 }}>
                          AI_MEMORY_RECALL
                        </Tag>
                      </span>
                    ),
                    options: recallWorkflows.map((w) => {
                      const nameKey = `workflow.builtin.${w.workflowKey}`;
                      const translatedName = w.workflowKey ? t(nameKey) : w.name;
                      const label =
                        translatedName !== nameKey
                          ? translatedName
                          : w.name || w.workflowKey || '未命名召回';
                      return { label, value: w._id };
                    }),
                  },
                ]
              : []),
            {
              label: '业务工作流',
              options: generalWorkflows.map((w) => ({
                label: w.name || w.workflowKey || '未命名流程',
                value: w._id,
              })),
            },
          ]}
        />
      </Form.Item>

      <Alert
        type="info"
        showIcon
        style={{ fontSize: 11 }}
        message="该工作流应当接收 query 参数并返回 contextString 字段作为输出。"
        description={
          <Text style={{ fontSize: 11 }}>
            建议的工作流结构：
            <br />
            <code>vectorSearch</code> → <code>fetchDocSection</code> → 输出
          </Text>
        }
      />
    </NodePropertyCollapse>
  );
};

export default RecallKnowledgeProperties;
