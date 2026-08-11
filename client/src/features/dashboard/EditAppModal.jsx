import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Form, Input, Button, Select, Space } from 'antd';
import * as AntdIcons from '@ant-design/icons';
import { updateApp } from '../../api/apps';

const { Option } = Select;

const iconOptions = [
  'FolderOutlined',
  'FileOutlined',
  'AppstoreOutlined',
  'StarOutlined',
  'SettingOutlined',
  'UserOutlined',
  'TeamOutlined',
  'ContainerOutlined',
  'CalendarOutlined',
  'BarChartOutlined',
];

const colorOptions = [
  '#1890ff',
  '#52c41a',
  '#faad14',
  '#f5222d',
  '#722ed1',
  '#eb2f96',
  '#7cb305',
  '#00a2ae',
  '#ffc53d',
  '#36cfc9',
];

const EditAppModal = ({ open, onClose, onAppUpdated, appToEdit }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  useEffect(() => {
    if (appToEdit) {
      form.setFieldsValue({
        name: appToEdit.name,
        description: appToEdit.description,
        icon: appToEdit.icon || 'FolderOutlined',
        iconColor: appToEdit.iconColor || '#1890ff',
      });
    } else {
      form.resetFields();
    }
  }, [appToEdit, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const res = await updateApp(appToEdit._id, values);
      onAppUpdated(res);
      onClose();
    } catch (error) {
      console.error('Failed to update application:', error);
    }
  };

  return (
    <Modal
      title={t('app.editTitle')}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={form.isSubmitting}
      destroyOnClose
      cancelText={t('common.cancel')}
      okText={t('common.save')}
    >
      <Form form={form} layout="vertical" name="edit_app_form">
        <Form.Item
          name="name"
          label={t('app.nameLabel')}
          rules={[{ required: true, message: t('app.nameRequired') }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="description" label={t('app.descriptionLabel')}>
          <Input.TextArea rows={4} />
        </Form.Item>
        <Form.Item name="icon" label={t('app.iconLabel')}>
          <Select>
            {iconOptions.map((iconName) => {
              const IconComponent = AntdIcons[iconName];
              return (
                <Option key={iconName} value={iconName}>
                  <Space>
                    {IconComponent && <IconComponent />}
                    {iconName}
                  </Space>
                </Option>
              );
            })}
          </Select>
        </Form.Item>
        <Form.Item name="iconColor" label={t('app.iconColorLabel')}>
          <Select>
            {colorOptions.map((color) => (
              <Option key={color} value={color}>
                <Space>
                  <div
                    style={{
                      width: '14px',
                      height: '14px',
                      background: color,
                      borderRadius: '2px',
                    }}
                  />
                  {color}
                </Space>
              </Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditAppModal;
