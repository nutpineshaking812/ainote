import React from 'react';
import { Table, Radio, Form, Typography } from 'antd';

const MatrixRenderer = ({ field, value, onChange }) => {
  const { rows = [], columns = [], label } = field.properties;
  const { required } = field.validation || {};

  const handleRadioChange = (rowValue, selectedColumnValue) => {
    const newValue = { ...(value || {}), [rowValue]: selectedColumnValue };
    onChange(newValue);
  };

  const allRowsCompleted = rows.every((row) => value && value[row.value]);
  const validateStatus = required && !allRowsCompleted ? 'error' : '';
  const help = required && !allRowsCompleted ? '请完成所有行的选择' : '';

  const tableColumns = [
    {
      title: '',
      dataIndex: 'label',
      key: 'label',
      width: '30%',
      render: (text) => <Typography.Text strong>{text}</Typography.Text>,
    },
    ...columns.map((col) => ({
      title: col.label,
      key: col.value,
      align: 'center',
      render: (text, record) => <Radio value={col.value} />,
    })),
  ];

  return (
    <Form.Item required={required} validateStatus={validateStatus}>
      <Table
        dataSource={rows}
        columns={tableColumns}
        pagination={false}
        bordered
        rowKey="value"
        components={{
          body: {
            row: ({ children, ...props }) => {
              const rowValue = props['data-row-key'];
              if (!rowValue) {
                return <tr {...props}>{children}</tr>;
              }
              return (
                <Radio.Group
                  value={value?.[rowValue]}
                  onChange={(e) => handleRadioChange(rowValue, e.target.value)}
                  style={{ display: 'contents' }}
                >
                  <tr {...props}>{children}</tr>
                </Radio.Group>
              );
            },
          },
        }}
      />
    </Form.Item>
  );
};

export default MatrixRenderer;
