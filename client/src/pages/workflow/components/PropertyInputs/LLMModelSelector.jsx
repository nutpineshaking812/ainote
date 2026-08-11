import React, { useState, useEffect } from 'react';
import { Select, Space, Typography, Tag } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { getAvailableModels } from '../../../../api/ai';

const { Text } = Typography;

const LLMModelSelector = ({ value, onChange, ...props }) => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await getAvailableModels();
        setProviders(data || []);
      } catch (e) {
        console.error('Failed to fetch AI models', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return (
    <Select
      {...props}
      value={value}
      onChange={onChange}
      loading={loading}
      placeholder="Select an AI model..."
      showSearch
      optionFilterProp="label"
    >
      {providers.map((p) => (
        <Select.OptGroup
          key={p.provider || p.id}
          label={(p.provider || p.id || 'Unknown').toUpperCase()}
        >
          {p.models.map((m) => (
            <Select.Option key={m} value={m} label={m}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <ThunderboltOutlined style={{ color: '#faad14' }} />
                  <Text size="small">{m}</Text>
                </Space>
              </Space>
            </Select.Option>
          ))}
        </Select.OptGroup>
      ))}
    </Select>
  );
};

export default LLMModelSelector;
