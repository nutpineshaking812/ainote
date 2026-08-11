import React, { useState, useEffect } from 'react';
import { Form, List, Checkbox, Badge } from 'antd';

const RankingRenderer = ({ field, value, onChange }) => {
  const { options, label } = field.properties;
  const { required } = field.validation || {};
  const [rankedItems, setRankedItems] = useState([]);

  useEffect(() => {
    if (value) {
      setRankedItems(value);
    }
  }, [value]);

  const handleCheck = (itemValue) => {
    const newRankedItems = [...rankedItems];
    const itemIndex = newRankedItems.indexOf(itemValue);

    if (itemIndex > -1) {
      // Un-rank the item
      newRankedItems.splice(itemIndex, 1);
    } else {
      // Rank the item
      newRankedItems.push(itemValue);
    }

    setRankedItems(newRankedItems);
    onChange(newRankedItems);
  };

  return (
    <Form.Item required={required}>
      <List
        bordered
        dataSource={options}
        renderItem={(option) => {
          const rank = rankedItems.indexOf(option.value) + 1;
          const isRanked = rank > 0;

          return (
            <List.Item
              onClick={() => handleCheck(option.value)}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
              }}
            >
              <div style={{ width: '40px' }}>
                {isRanked ? (
                  <Badge count={rank} style={{ backgroundColor: '#1890ff' }} />
                ) : (
                  <Checkbox checked={false} />
                )}
              </div>
              <div>{option.label}</div>
            </List.Item>
          );
        }}
      />
    </Form.Item>
  );
};

export default RankingRenderer;
