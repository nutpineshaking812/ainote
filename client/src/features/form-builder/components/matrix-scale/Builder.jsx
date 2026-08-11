import React from 'react';
import { Table, Radio } from 'antd';

const Builder = ({ field }) => {
  const { rows, columns, label } = field.properties;

  const tableColumns = [
    {
      title: '',
      dataIndex: 'label',
      key: 'label',
    },
    ...columns.map((col) => ({
      title: col.label,
      dataIndex: col.value,
      key: col.value,
      render: () => <Radio disabled />,
    })),
  ];

  const data = rows.map((row) => ({
    key: row.value,
    label: row.label,
  }));

  return (
    <div style={{ pointerEvents: 'none' }}>
      {/* <p>{label}</p> */}
      <Table columns={tableColumns} dataSource={data} pagination={false} bordered />
    </div>
  );
};

export default Builder;
