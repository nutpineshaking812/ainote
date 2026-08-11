import React, { useState, useEffect } from 'react';
import { Select } from 'antd';
import { getWorkflows } from '../../../../api/workflow';

const WorkflowSelector = ({ value, onChange, appId, placeholder }) => {
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

  return (
    <Select
      value={value}
      onChange={onChange}
      loading={loading}
      placeholder={placeholder || '请选择工作流'}
      showSearch
      optionFilterProp="label"
      options={[
        {
          label: '业务工作流',
          options: workflows
            .filter((w) => !w.category || w.category === 'GENERAL')
            .map((w) => ({ label: w.name || w.workflowKey || '未命名流程', value: w._id })),
        },
        {
          label: '系统策略 (Built-in)',
          options: workflows
            .filter((w) => w.category === 'AI_MEMORY_RECALL' || w.category === 'AI_MEMORY_DISTILL')
            .map((w) => ({ label: w.name || w.workflowKey, value: w._id })),
        },
      ]}
      style={{ width: '100%' }}
    />
  );
};

export default WorkflowSelector;
