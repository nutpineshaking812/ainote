import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  message,
  Typography,
  Modal,
  Avatar,
  Divider,
  theme,
} from 'antd';
import {
  UserAddOutlined,
  IdcardOutlined,
  DeploymentUnitOutlined,
  CloseOutlined,
  CameraOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  createDigitalEmployee,
  updateDigitalEmployee,
  getDigitalEmployeePresets,
} from '../../../api/digital-employees';
import ImageUploadCrop from '../../../components/common/ImageUploadCrop';
import { EMPLOYEE_SCENARIO_OPTIONS } from '../../../constants/employee';

const { Title, Text } = Typography;

const ROLE_KEYS = [
  'CEO',
  'Product',
  'Developer',
  'QA',
  'Designer',
  'CustomerSupport',
  'Operations',
  'Copywriter',
  'DataAnalyst',
];

const EmployeeEditModal = ({ open, onClose, employeeToEdit, appId, onSaved }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tempAvatar, setTempAvatar] = useState(employeeToEdit?.avatar || '');
  const [presets, setPresets] = useState([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [selectedPresetName, setSelectedPresetName] = useState(null);
  const [currentPresetMetadata, setCurrentPresetMetadata] = useState({});

  const nameWatch = Form.useWatch('name', form);

  const isEdit = !!employeeToEdit;

  useEffect(() => {
    if (open) {
      setSelectedPresetName(null);
      setCurrentPresetMetadata({});
      if (employeeToEdit) {
        form.setFieldsValue({
          ...employeeToEdit,
          roleTitle: employeeToEdit.roleTitle ? [employeeToEdit.roleTitle] : [],
          scenario: employeeToEdit.scenario || 'GENERAL',
          ...(employeeToEdit.metadata || {}),
        });
        setTempAvatar(employeeToEdit.avatar || '');
        setCurrentPresetMetadata(employeeToEdit.metadata || {});
      } else {
        form.resetFields();
        form.setFieldsValue({ scenario: 'GENERAL' });
        setTempAvatar('');
      }
    }
  }, [open, employeeToEdit, form]);

  useEffect(() => {
    if (open && !isEdit) {
      const fetchPresets = async () => {
        try {
          setLoadingPresets(true);
          const res = await getDigitalEmployeePresets(appId);
          setPresets(res.data || res || []);
        } catch (err) {
          console.error('Failed to load presets:', err);
        } finally {
          setLoadingPresets(false);
        }
      };
      fetchPresets();
    }
  }, [open, isEdit, appId]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const basicFields = [
        'name',
        'roleTitle',
        'avatar',
        'description',
        'scenario',
        'workflowId',
        'isActive',
      ];
      const metadata = {};
      const payload = {};

      Object.keys(values).forEach((key) => {
        if (basicFields.includes(key)) {
          payload[key] = values[key];
        } else {
          metadata[key] = values[key];
        }
      });

      // 完美的元数据合流合并逻辑
      const mergedMetadata = {
        // model: 'gpt-4o',
        // skillIds: [],
        // knowledgeSetIds: [],
        ...currentPresetMetadata, // 载入完整 Preset config 的配置 (如 model, skillIds 等)
        ...metadata, // Form 中已绑定的修改字段最高优先级覆盖
      };

      const processedValues = {
        ...payload,
        roleTitle: payload.roleTitle && payload.roleTitle.length > 0 ? payload.roleTitle[0] : '',
        metadata: mergedMetadata,
      };

      if (isEdit) {
        await updateDigitalEmployee(appId, {
          id: employeeToEdit.id,
          ...processedValues,
        });
        message.success('档案同步成功');
        onSaved();
      } else {
        const res = await createDigitalEmployee(appId, processedValues);
        message.success('新数字员工入职完毕');
        const createdEmployee = res.data || res;
        const newId = createdEmployee?.id || createdEmployee?._id;
        onSaved(newId);
      }
      onClose();
    } catch (err) {
      if (err.errorFields) return;
      message.error(`操作失败: ${err.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={!isEdit && presets.length > 0 ? 1040 : 600}
      centered
      styles={{
        mask: { backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.05)' },
        content: {
          padding: 0,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        },
      }}
      destroyOnClose
    >
      {/* Compact Elegant Studio Header */}
      <div
        style={{
          height: 72,
          background: '#f8fafc',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          position: 'relative',
        }}
      >
        <div>
          <Title
            level={5}
            style={{ margin: 0, color: '#0f172a', fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}
          >
            {isEdit ? '编辑数字员工' : '新建数字员工'}
          </Title>
          <Text
            type="secondary"
            style={{
              fontSize: 11,
              marginTop: 2,
              display: 'block',
              fontWeight: 500,
              color: '#64748b',
            }}
          >
            {isEdit ? '修改并调整当前员工档案' : '引入精英模板或自定义创建'}
          </Text>
        </div>

        <Button
          type="text"
          icon={<CloseOutlined style={{ color: '#94a3b8', fontSize: 14 }} />}
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            padding: 0,
          }}
        />
      </div>

      {/* Inject Style to Hide Webkit Scrollbars Seamlessly */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
      `}</style>

      <div style={{ padding: '24px' }}>
        <Form form={form} layout="vertical" requiredMark={false} colon={false}>
          <div style={{ display: 'flex', gap: 24 }}>
            {/* 左侧：数字化内置角色 (完全隐藏物理滚动条，微型电子积木卡片) */}
            {!isEdit && presets.length > 0 && (
              <div
                style={{
                  width: 400,
                  height: 320,
                  flexShrink: 0,
                  borderRight: '1px solid #f1f5f9',
                  paddingRight: 20,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ marginBottom: 10 }}>
                  <span
                    style={{
                      fontWeight: 800,
                      color: '#0f172a',
                      fontSize: 13,
                      display: 'block',
                      lineHeight: 1.2,
                    }}
                  >
                    内置角色
                  </span>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, fontWeight: 500 }}>
                    一键载入配置
                  </div>
                </div>

                <div
                  className="hide-scrollbar"
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    alignContent: 'start',
                    gap: 8,
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                  }}
                >
                  {presets.map((tmpl) => {
                    const isSelected = selectedPresetName === tmpl.name;

                    return (
                      <div
                        key={tmpl.name}
                        onClick={() => {
                          if (isSelected) {
                            // 反选清空逻辑
                            form.resetFields();
                            form.setFieldsValue({ scenario: 'GENERAL' });
                            setTempAvatar('');
                            setSelectedPresetName(null);
                            setCurrentPresetMetadata({});
                          } else {
                            // 选中导入逻辑
                            form.setFieldsValue({
                              name: tmpl.name,
                              roleTitle: tmpl.roleTitle ? [tmpl.roleTitle] : [],
                              scenario: tmpl.scenario || 'GENERAL',
                              description: tmpl.description || '',
                              avatar: tmpl.avatar || '',
                              roleKey: tmpl.roleKey || '',
                              ...(tmpl.metadata || {}),
                            });
                            setTempAvatar(tmpl.avatar || '');
                            setSelectedPresetName(tmpl.name);
                            setCurrentPresetMetadata(tmpl.metadata || {});
                          }
                        }}
                        style={{
                          border: isSelected
                            ? `2px solid ${token.colorPrimary}`
                            : '1.5px solid #e2e8f0',
                          borderRadius: 8,
                          padding: '6px 10px',
                          cursor: 'pointer',
                          background: isSelected ? '#f8fafc' : '#ffffff',
                          boxShadow: isSelected
                            ? '0 1px 6px rgba(59, 130, 246, 0.04)'
                            : '0 1px 2px rgba(0,0,0,0.01)',
                          transition: 'all 0.2s ease',
                          position: 'relative',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          minHeight: 46,
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = token.colorPrimary;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                          }
                        }}
                      >
                        {/* Compact Header Layout */}
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}
                        >
                          <Avatar
                            src={tmpl.avatar}
                            size={28}
                            style={{
                              border: '1.5px solid #f1f5f9',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                              flexShrink: 0,
                            }}
                          >
                            {tmpl.name?.split('')?.[0] || '?'}
                          </Avatar>
                          <div
                            style={{
                              minWidth: 0,
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 11,
                                color: '#0f172a',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                lineHeight: 1.1,
                              }}
                            >
                              {tmpl.name}
                              <span
                                style={{
                                  fontSize: 8,
                                  padding: '1px 3px',
                                  borderRadius: 2,
                                  color: '#475569',
                                  background: '#f1f5f9',
                                  fontWeight: 600,
                                }}
                              >
                                {tmpl.scenario === 'GENERAL' ? '通用' : tmpl.scenario || '通用'}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 9,
                                color: '#64748b',
                                fontWeight: 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                marginTop: 1,
                              }}
                            >
                              {(() => {
                                const match = ROLE_KEYS.find(
                                  (k) => k.toLowerCase() === tmpl.roleTitle?.toLowerCase(),
                                );
                                return match
                                  ? t(`digitalEmployee.rolePresets.${match}`)
                                  : tmpl.roleTitle;
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Selection Checkmark */}
                        {isSelected && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              right: 0,
                              width: 0,
                              height: 0,
                              borderStyle: 'solid',
                              borderWidth: '0 20px 20px 0',
                              borderColor: `transparent ${token.colorPrimary} transparent transparent`,
                            }}
                          >
                            <span
                              style={{
                                position: 'absolute',
                                top: 1,
                                right: -17,
                                color: '#ffffff',
                                fontSize: 7,
                                fontWeight: 900,
                              }}
                            >
                              ✓
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 右侧：自定义创建表单 (高度320px固定，与左侧等高对齐) */}
            <div
              style={{
                flex: 1,
                paddingLeft: 4,
                height: 320,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 14 }}
                >
                  {/* 头像上传 */}
                  <div style={{ flexShrink: 0, marginTop: 4 }}>
                    <Form.Item name="avatar" noStyle>
                      <Input hidden />
                    </Form.Item>
                    <Form.Item name="roleKey" noStyle>
                      <Input hidden />
                    </Form.Item>
                    <Form.Item name="systemPrompt" noStyle>
                      <Input hidden />
                    </Form.Item>
                    <ImageUploadCrop
                      value={tempAvatar}
                      onChange={(url) => {
                        form.setFieldsValue({ avatar: url });
                        setTempAvatar(url);
                      }}
                      onStatusChange={setUploading}
                      usageType="digital_employee_avatar"
                      usageId={employeeToEdit?.id || 'new'}
                      maxWidth={200}
                      maxHeight={200}
                    >
                      <div
                        style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}
                      >
                        <Avatar
                          size={72}
                          src={tempAvatar}
                          style={{
                            flexShrink: 0,
                            backgroundColor: !tempAvatar ? '#f0f2f5' : 'transparent',
                            color: token.colorPrimary,
                            fontSize: 28,
                            fontWeight: 700,
                            border: '3px solid #fff',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                          }}
                        >
                          {uploading ? <LoadingOutlined /> : nameWatch?.[0] || '?'}
                        </Avatar>
                        <Button
                          shape="circle"
                          size="small"
                          icon={<CameraOutlined style={{ fontSize: 10 }} />}
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: 22,
                            height: 22,
                            minWidth: 22,
                            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                            zIndex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                          }}
                        />
                      </div>
                    </ImageUploadCrop>
                  </div>

                  {/* 名字与岗位 */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <Form.Item
                          name="name"
                          label={
                            <span style={{ fontWeight: 600, color: '#475569', fontSize: 12 }}>
                              名字 / 称谓
                            </span>
                          }
                          rules={[{ required: true, message: '请设定名字' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input size="middle" placeholder="输入称谓" style={{ borderRadius: 6 }} />
                        </Form.Item>
                      </div>
                      <div style={{ flex: 1 }}>
                        <Form.Item
                          name="roleTitle"
                          label={
                            <span style={{ fontWeight: 600, color: '#475569', fontSize: 12 }}>
                              职能岗位
                            </span>
                          }
                          style={{ marginBottom: 0 }}
                        >
                          <Select
                            mode="tags"
                            maxCount={1}
                            size="middle"
                            placeholder="选择或自定义"
                            style={{ borderRadius: 6 }}
                            options={ROLE_KEYS.map((k) => ({
                              label: t(`digitalEmployee.rolePresets.${k}`),
                              value: k,
                            }))}
                          />
                        </Form.Item>
                      </div>
                    </div>
                  </div>
                </div>

                <Form.Item
                  name="scenario"
                  label={
                    <span style={{ fontWeight: 600, color: '#475569', fontSize: 12 }}>
                      适用场景
                    </span>
                  }
                  rules={[{ required: true, message: '请选择适用场景' }]}
                  style={{ marginBottom: 12 }}
                >
                  <Select
                    size="middle"
                    placeholder="选择该数字员工的适用场景"
                    style={{ borderRadius: 6 }}
                    options={EMPLOYEE_SCENARIO_OPTIONS}
                  />
                </Form.Item>

                <Form.Item
                  name="description"
                  label={
                    <span style={{ fontWeight: 600, color: '#475569', fontSize: 12 }}>
                      人格描述
                    </span>
                  }
                  style={{ marginBottom: 0 }}
                >
                  <Input.TextArea
                    placeholder="定义它的专业背景、对话风格或默认任务..."
                    autoSize={false}
                    style={{
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 12,
                      height: 60,
                      resize: 'none',
                    }}
                  />
                </Form.Item>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
                <Button onClick={onClose} size="middle" style={{ borderRadius: 6 }}>
                  取消
                </Button>
                <Button
                  type="primary"
                  size="middle"
                  loading={loading}
                  onClick={handleSubmit}
                  style={{
                    borderRadius: 6,
                    fontWeight: 600,
                    background: '#0f172a',
                    border: 'none',
                  }}
                  icon={isEdit ? null : <UserAddOutlined />}
                >
                  {isEdit ? '更新档案' : '确认创建'}
                </Button>
              </div>
            </div>
          </div>
        </Form>
      </div>

      {/* Subtle Background Pattern */}
      <div
        style={{
          position: 'absolute',
          bottom: -20,
          right: -20,
          opacity: 0.03,
          fontSize: 120,
          color: '#000',
          pointerEvents: 'none',
        }}
      >
        <DeploymentUnitOutlined />
      </div>
    </Modal>
  );
};

export default EmployeeEditModal;
