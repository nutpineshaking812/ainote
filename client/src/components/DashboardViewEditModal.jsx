import React, { useState, useEffect } from 'react';
import { Modal, Button, message, Typography, Space, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { InfoCircleOutlined } from '@ant-design/icons';
import ChartCanvas from '../features/views/components/ChartCanvas.jsx';

const { Title, Text } = Typography;

const DashboardViewEditModal = ({ open, onClose, dashboardLayoutComponents, onSave }) => {
  const { t } = useTranslation();
  const [editingLayout, setEditingLayout] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const layoutWithIds = dashboardLayoutComponents.map((comp) => ({
        ...comp,
        id: comp.id || comp.layoutId || comp.componentId,
      }));
      setEditingLayout(layoutWithIds);
    }
  }, [open, dashboardLayoutComponents]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saveResult = editingLayout.map((c) => {
        const item = { ...c };
        delete item.layout;
        return item;
      });
      await onSave(saveResult);
      message.success(t('dashboard.layoutSaveSuccess'));
      onClose();
    } catch (error) {
      message.error(error.message || t('dashboard.layoutSaveFailed'));
      console.error('Failed to save dashboard layout:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleChartsChange = (newCharts) => {
    const updatedCharts = newCharts.map((c) => {
      const d = { ...c, w: c.layout.w, h: c.layout.h, x: c.layout.x, y: c.layout.y };
      return d;
    });
    setEditingLayout(updatedCharts);
  };

  return (
    <Modal
      title={
        <Space direction="vertical" size={0}>
          <Title level={4} style={{ margin: 0 }}>
            {t('dashboard.editLayout')}
          </Title>
          <Space size={4}>
            <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
              {t('dashboard.editLayoutDesc')}
            </Text>
          </Space>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width="95%"
      style={{ top: 24 }}
      styles={{ body: { padding: '0px' } }}
      maskClosable={false}
      footer={[
        <Button key="cancel" onClick={onClose} style={{ borderRadius: 6 }}>
          {t('common.cancel')}
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={saving}
          onClick={handleSave}
          style={{ borderRadius: 6, minWidth: 80 }}
        >
          {t('common.save')}
        </Button>,
      ]}
    >
      <Divider style={{ margin: 0 }} />
      <div
        style={{
          minHeight: '80vh',
          background: '#f8fafc',
          padding: '20px',
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 200px)',
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            minHeight: '100%',
            border: '1px dashed #d1d5db',
            padding: 12,
          }}
        >
          <ChartCanvas charts={editingLayout} onChartsChange={handleChartsChange} />
        </div>
      </div>
      <Divider style={{ margin: 0 }} />
    </Modal>
  );
};

export default DashboardViewEditModal;
