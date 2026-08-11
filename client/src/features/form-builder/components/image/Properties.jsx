import React from 'react';
import { Form, Input, Typography, Checkbox, InputNumber, Radio, Space, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import SectionHeader from '../../SectionHeader.jsx';

const Properties = ({ field, updateField }) => {
  const properties = field.properties || {};
  const {
    label = '图片',
    maxCountEnabled = false,
    maxCount = 1,
    displayMode = 'card',
    autoCompressEnabled = false,
    maxFileSizeEnabled = false,
    maxFileSizeMB = 2,
  } = properties;

  const resolvedMaxCountValue = Number.isFinite(maxCount) ? maxCount : Number(maxCount) || 1;
  const displayModeValue = displayMode === 'list' ? 'list' : 'card';
  const resolvedMaxFileSizeValue =
    typeof maxFileSizeMB === 'number' && !Number.isNaN(maxFileSizeMB)
      ? maxFileSizeMB
      : Number(maxFileSizeMB) || 2;

  const setProperties = (patch) => {
    updateField(field.id, { ...properties, ...patch });
  };

  const v = field.validation || {};
  const updateValidation = (patch) => {
    const next = { ...v, ...patch };
    Object.keys(next).forEach((k) => {
      if (next[k] === undefined || next[k] === null) delete next[k];
    });
    updateField(field.id, next, 'validation');
  };
  return (
    <>
      <SectionHeader title="属性" />
      <Form.Item label="字段 ID">
        <Input value={field.id} disabled style={{ background: '#fafafa' }} />
      </Form.Item>
      <Form.Item label="标题">
        <Input.TextArea
          value={label}
          onChange={(e) => setProperties({ label: e.target.value })}
          rows={3}
        />
      </Form.Item>
      <SectionHeader title="上传设置" />
      <Form.Item colon={false} style={{ marginBottom: 0 }}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Space align="center" size={8}>
            <Checkbox
              checked={maxCountEnabled}
              onChange={(e) => {
                const checked = e.target.checked;
                const patch = { maxCountEnabled: checked };
                if (checked && (!Number.isFinite(maxCount) || maxCount <= 0)) {
                  patch.maxCount = 1;
                }
                setProperties(patch);
              }}
            >
              数量限制
            </Checkbox>
            <Tooltip title="限制可上传的图片数量，超出后将无法继续添加。">
              <InfoCircleOutlined style={{ color: '#9aa0a6' }} />
            </Tooltip>
          </Space>
          {maxCountEnabled && (
            <Space align="center" size={8}>
              <InputNumber
                min={1}
                precision={0}
                value={resolvedMaxCountValue}
                onChange={(value) => {
                  const safe = Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
                  setProperties({ maxCount: safe });
                }}
              />
              <Typography.Text type="secondary">张</Typography.Text>
            </Space>
          )}
        </Space>
      </Form.Item>
      <Form.Item colon={false} style={{ marginBottom: 0 }}>
        <Space align="center" size={8}>
          <Checkbox
            checked={autoCompressEnabled}
            onChange={(e) => setProperties({ autoCompressEnabled: e.target.checked })}
          >
            启用自动压缩
          </Checkbox>
          <Tooltip title="选中后会自动压缩图片以减小体积，适合上传较大的原图。">
            <InfoCircleOutlined style={{ color: '#9aa0a6' }} />
          </Tooltip>
        </Space>
      </Form.Item>
      <Form.Item colon={false} style={{ marginBottom: 24 }}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Space align="center" size={8}>
            <Checkbox
              checked={maxFileSizeEnabled}
              onChange={(e) => {
                const checked = e.target.checked;
                const patch = { maxFileSizeEnabled: checked };
                if (checked && (!Number.isFinite(maxFileSizeMB) || maxFileSizeMB <= 0)) {
                  patch.maxFileSizeMB = 2;
                }
                setProperties(patch);
              }}
            >
              单文件大小上限
            </Checkbox>
            <Tooltip title="限制单张图片的文件大小，超过上限将无法上传。">
              <InfoCircleOutlined style={{ color: '#9aa0a6' }} />
            </Tooltip>
          </Space>
          {maxFileSizeEnabled && (
            <>
              <Space align="center">
                <InputNumber
                  min={0.1}
                  step={0.1}
                  precision={1}
                  value={resolvedMaxFileSizeValue}
                  onChange={(value) => {
                    let safe = 2;
                    if (typeof value === 'number' && !Number.isNaN(value) && value > 0) {
                      safe = Math.round(value * 10) / 10;
                    }
                    setProperties({ maxFileSizeMB: safe });
                  }}
                />
                <Typography.Text type="secondary">MB</Typography.Text>
              </Space>
              <Typography.Text type="secondary">超出上限的文件将无法上传</Typography.Text>
            </>
          )}
        </Space>
      </Form.Item>
      <SectionHeader title="显示样式" />
      <Form.Item colon={false} style={{ marginBottom: 0 }}>
        <Radio.Group
          value={displayModeValue}
          onChange={(e) => setProperties({ displayMode: e.target.value })}
        >
          <Radio.Button value="card">卡片</Radio.Button>
          <Radio.Button value="list">列表</Radio.Button>
        </Radio.Group>
      </Form.Item>
      <SectionHeader title="校验" />
      <Form.Item>
        <Checkbox
          checked={v.required === true}
          onChange={(e) => updateValidation({ required: e.target.checked })}
        >
          必填
        </Checkbox>
      </Form.Item>
    </>
  );
};

export default Properties;
