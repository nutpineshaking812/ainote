import React from 'react';
import { List, Checkbox } from 'antd';

const Builder = ({ field }) => {
  const { options, label } = field.properties;

  return (
    <div style={{ pointerEvents: 'none' }}>
      <List
        bordered
        dataSource={options}
        renderItem={(option) => (
          <List.Item>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '40px' }}>
                <Checkbox checked={false} />
              </div>
              <div>{option.label}</div>
            </div>
          </List.Item>
        )}
      />
    </div>
  );
};

export default Builder;
