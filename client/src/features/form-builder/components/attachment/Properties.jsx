import React from 'react';
import {
  Form,
  Input,
  Typography,
  Checkbox,
  InputNumber,
  Space,
  Tooltip,
  Select,
  Divider,
} from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import SectionHeader from '../../SectionHeader.jsx';

const Properties = ({ field, updateField }) => {
  const properties = field.properties || {};
  const {
    label = '附件',
    maxCountEnabled = false,
    maxCount = 3,
    maxFileSizeEnabled = false,
    maxFileSizeMB = 20,
    allowedTypes = [],
  } = properties;

  const resolvedMaxCountValue = Number.isFinite(maxCount) ? maxCount : Number(maxCount) || 1;
  const resolvedMaxFileSizeValue =
    typeof maxFileSizeMB === 'number' && !Number.isNaN(maxFileSizeMB)
      ? maxFileSizeMB
      : Number(maxFileSizeMB) || 20;

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
            <Tooltip title="限制可上传的附件数量，超出后无法继续添加。">
              <InfoCircleOutlined style={{ color: '#9aa0a6' }} />
            </Tooltip>
          </Space>
          {maxCountEnabled && (
            <Space align="center" size={8}>
              <InputNumber
                min={1}
                precision={0}
                value={resolvedMaxCountValue}
                onChange={(v) => {
                  const safe = Number.isFinite(v) && v > 0 ? Math.floor(v) : 1;
                  setProperties({ maxCount: safe });
                }}
              />
              <Typography.Text type="secondary">个</Typography.Text>
            </Space>
          )}
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
                  patch.maxFileSizeMB = 20;
                }
                setProperties(patch);
              }}
            >
              单文件大小上限
            </Checkbox>
            <Tooltip title="限制单个附件的大小。">
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
                  onChange={(v) => {
                    let safe = 20;
                    if (typeof v === 'number' && !Number.isNaN(v) && v > 0) {
                      safe = Math.round(v * 10) / 10;
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
      <Tooltip title="限制可上传附件的扩展名；留空表示不限制。">
        <div>
          <SectionHeader title="文件类型" />
        </div>
      </Tooltip>
      <Form.Item colon={false} style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          <Select
            mode="multiple"
            placeholder="选择允许的文件扩展名，如 pdf, docx, xls"
            value={allowedTypes}
            onChange={(vals) => setProperties({ allowedTypes: vals })}
            options={[
              'pdf',
              'document',
              'docx',
              'xls',
              'xlsx',
              'csv',
              'ppt',
              'pptx',
              'zip',
              'rar',
              '7z',
              'txt',
              'json',
              'md',
              'png',
              'jpg',
              'jpeg',
              'gif',
              'svg',
              'webp',
            ].map((ext) => ({ label: ext, value: ext }))}
            allowClear
            maxTagCount={6}
          />
          {/* <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            留空则不限制类型。扩展名匹配（不含点），大小写不敏感。
          </Typography.Text> */}
        </Space>
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
      <Form.Item label="特殊属性">
        <Checkbox
          checked={properties.readOnly === true}
          onChange={(e) => setProperties({ readOnly: e.target.checked })}
        >
          只读
        </Checkbox>
        <Checkbox
          checked={properties.hidden === true}
          onChange={(e) => setProperties({ hidden: e.target.checked })}
        >
          隐藏
        </Checkbox>
      </Form.Item>
    </>
  );
};

export default Properties;
