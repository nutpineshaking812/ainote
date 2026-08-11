import React from 'react';
import { Form, InputNumber, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import NodePropertyCollapse from './NodePropertyCollapse';
import VariableInput from '../../components/PropertyInputs/VariableInput';

/**
 * 通用记忆节点属性面板
 * type: 'vectorIndex' | 'vectorSearch' | 'fetchMemorySection' | 'upsertMemorySection' | 'getExecutionLogs'
 */
const MemoryNodeProperties = ({ node, setNodes, type, currentNodeId }) => {
  const { t } = useTranslation();

  const renderFields = () => {
    switch (type) {
      case 'vectorIndex':
        return (
          <>
            <Alert
              type="info"
              showIcon
              message="将指定笔记从 Document 表同步到向量检索池。注意：这会使笔记内容可被全站或当前会话召回。"
              style={{ marginBottom: 16, fontSize: 12 }}
            />
            <Form.Item
              label="笔记 ID"
              name="documentId"
              rules={[{ required: true, message: '请输入笔记 ID' }]}
              extra="支持变量语法，如 {{trigger.documentId}}"
            >
              <VariableInput 
                placeholder="{{documentId}}" 
                
                currentNodeId={currentNodeId || node?.id}
              />
            </Form.Item>
          </>
        );

      case 'vectorSearch':
        return (
          <>
            <Alert
              type="info"
              showIcon
              message="根据语义相似度搜索记忆库，自动混合召回「全局知识」与「当前会话私有记忆」。"
              style={{ marginBottom: 16, fontSize: 12 }}
            />
            <Form.Item
              label="搜索问题 (Query)"
              name="query"
              rules={[{ required: true, message: '请输入搜索内容' }]}
              extra="支持变量语法，如 {{trigger.input}}"
            >
              <VariableInput
                placeholder="{{trigger.userInput}}"
                
                currentNodeId={currentNodeId || node?.id}
              />
            </Form.Item>
            <Form.Item label="返回条数" name="limit">
              <InputNumber min={1} max={20} defaultValue={5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="最低匹配分数 (0~1)" name="minScore">
              <InputNumber
                min={0}
                max={1}
                step={0.05}
                defaultValue={0.5}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </>
        );

      case 'fetchMemorySection':
        return (
          <>
            <Alert
              type="info"
              showIcon
              message="根据向量检索返回的定位信息，从数据库中取回实际的段落文本内容。通常跟在 vectorSearch 节点之后使用。"
              style={{ marginBottom: 16, fontSize: 12 }}
            />
            <Form.Item
              label="检索结果"
              name="results"
              extra="引用上一个 vectorSearch 节点的输出，如 {{nodeId.results}}"
            >
              <VariableInput
                placeholder="{{vectorSearch_node.results}}"
                
                currentNodeId={currentNodeId || node?.id}
              />
            </Form.Item>
          </>
        );

      case 'upsertMemorySection':
        return (
          <>
            <Alert
              type="info"
              showIcon
              message="更新或创建一张「记忆卡片」。这些卡片独立存储在 AIMemory 表中，不会污染笔记树。"
              style={{ marginBottom: 16, fontSize: 12 }}
            />
            <Form.Item
              label="知识项标题"
              name="targetTitle"
              rules={[{ required: true, message: '请输入记忆项的唯一标题' }]}
              extra="相同标题在同一会话下会执行更新操作。例如：## 用户偏好"
            >
              <VariableInput 
                placeholder="## 业务事实" 
                
                currentNodeId={currentNodeId || node?.id} 
              />
            </Form.Item>
            <Form.Item
              label="知识分类"
              name="category"
              initialValue="FACT"
              extra="SOP (规则), FACT (事实), PREFERENCE (偏好)"
            >
              <VariableInput 
                placeholder="FACT" 
                
                currentNodeId={currentNodeId || node?.id} 
              />
            </Form.Item>
            <Form.Item
              label="更新内容"
              name="content"
              rules={[{ required: true, message: '请输入要写入的内容' }]}
              extra="支持变量语法，如 {{aiAgent.result}}"
            >
              <VariableInput
                rows={4}
                placeholder="{{aiAgent_result}}"
                
                currentNodeId={currentNodeId || node?.id}
              />
            </Form.Item>
          </>
        );

      case 'getExecutionLogs':
        return (
          <>
            <Alert
              type="info"
              showIcon
              message="获取当前应用最近的执行记录，通常作为记忆提炼工作流的数据源。"
              style={{ marginBottom: 16, fontSize: 12 }}
            />
            <Form.Item label="获取条数" name="limit">
              <InputNumber min={1} max={50} defaultValue={5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="状态筛选" name="status">
              <VariableInput 
                placeholder="SUCCESS" 
                
                currentNodeId={currentNodeId || node?.id}
              />
            </Form.Item>
          </>
        );

      case 'getMemoryHeaders':
        return (
          <>
            <Alert
              type="info"
              showIcon
              message="检索当前会话中已存在的知识大纲（标题列表）。常用于引导 AI 提炼时复用现有标题，防止冗余。"
              style={{ marginBottom: 16, fontSize: 12 }}
            />
            <Form.Item
              label="分类筛选"
              name="category"
              initialValue="FACT"
              extra="留空则获取所有分类 (FACT/SOP/DECISION) 的大纲"
            >
              <VariableInput 
                placeholder="{{category}}" 
                
                currentNodeId={currentNodeId || node?.id}
              />
            </Form.Item>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <NodePropertyCollapse node={node} setNodes={setNodes}>
      {renderFields()}
    </NodePropertyCollapse>
  );
};

export const VectorIndexProperties = (props) => (
  <MemoryNodeProperties {...props} type="vectorIndex" />
);
export const VectorSearchProperties = (props) => (
  <MemoryNodeProperties {...props} type="vectorSearch" />
);
export const FetchMemorySectionProperties = (props) => (
  <MemoryNodeProperties {...props} type="fetchMemorySection" />
);
export const UpsertMemorySectionProperties = (props) => (
  <MemoryNodeProperties {...props} type="upsertMemorySection" />
);
export const GetExecutionLogsProperties = (props) => (
  <MemoryNodeProperties {...props} type="getExecutionLogs" />
);
export const GetMemoryHeadersProperties = (props) => (
  <MemoryNodeProperties {...props} type="getMemoryHeaders" />
);

export default MemoryNodeProperties;
