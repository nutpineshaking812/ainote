import React, { useState } from 'react';
import { Modal, Space, Button } from 'antd';
import FormDataQueryTable from './FormDataQueryTable';

/**
 * DataSelectModal
 * 单条数据选择弹框。
 * Props:
 *  - open: 是否显示
 *  - onClose: 关闭回调
 *  - onSelect(record): 选中后回调
 *  - fetchRecords: 异步获取数据函数 (q, page, pageSize) => { items, total }
 *  - formSchema: 表单结构，用于动态生成列配置
 */
const DataSelectModal = ({ open, onClose, onSelect, fetchRecords, formSchema }) => {
  const [selected, setSelected] = useState(null);

  return (
    <Modal
      open={open}
      title="选择数据记录"
      onCancel={onClose}
      width={880}
      destroyOnClose
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            disabled={!selected}
            onClick={() => {
              if (selected) onSelect(selected);
            }}
          >
            确定
          </Button>
        </Space>
      }
    >
      <FormDataQueryTable
        formSchema={formSchema}
        fetchRecords={fetchRecords}
        fieldColumnLimit={6}
        selectionMode="single"
        selectedId={selected ? selected.id || selected._id : undefined}
        onSelectionChange={(rec) => setSelected(rec)}
        pageSize={5}
        showCreatedAt
      />
    </Modal>
  );
};

export default DataSelectModal;
