import React from 'react';
import { Modal, Button } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

const DeleteAppModal = ({ open, onClose, onConfirm, confirmLoading }) => {
  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 22, marginRight: 16 }} />
          <span>Are you sure you want to delete this application?</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="back" onClick={onClose}>
          No
        </Button>,
        <Button key="submit" type="primary" danger loading={confirmLoading} onClick={onConfirm}>
          Yes, delete it
        </Button>,
      ]}
    >
      <p>This action cannot be undone.</p>
    </Modal>
  );
};

export default DeleteAppModal;
