import { useTranslation } from 'react-i18next';
import { Modal, Form, Input, Button, Select, Space, message } from 'antd';
import * as AntdIcons from '@ant-design/icons';
import { createApp } from '../../api/apps';
import { useAsyncAction } from '../../hooks/useAsyncAction';

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

const CreateAppModal = ({ open, onClose, onAppCreated }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const [handleOk, confirmLoading] = useAsyncAction(async () => {
    try {
      const values = await form.validateFields();
      const res = await createApp(values);
      onAppCreated(res);
      form.resetFields();
      onClose();
    } catch (error) {
      console.error('Failed to create application:', error);
      // 显示错误信息给用户
      if (error.message && !error.errorFields) {
        message.error(error.message);
      } else if (!error.errorFields) {
        // validateFields error throws object with errorFields, we skip message for validation errors
        // as they show on fields directly. But for api errors we show toast.
        message.error(t('common.operationFailed'));
      }
    }
  });

  return (
    <Modal
      title={t('app.createTitle')}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={confirmLoading}
      cancelText={t('common.cancel')}
      okText={t('common.save')}
    >
      <Form form={form} layout="vertical" name="create_app_form">
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
        <Form.Item name="icon" label={t('app.iconLabel')} initialValue="FolderOutlined">
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
        <Form.Item name="iconColor" label={t('app.iconColorLabel')} initialValue="#1890ff">
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

export default CreateAppModal;
