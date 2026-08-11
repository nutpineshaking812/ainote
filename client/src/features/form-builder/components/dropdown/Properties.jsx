import React from 'react';
import { Form, Input, Button, Space, Checkbox, Select, Tooltip } from 'antd';
import { PlusOutlined, MinusCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import SectionHeader from '../../SectionHeader.jsx';
import FormFieldSourceSelector from '../shared/FormFieldSourceSelector.jsx';

const STATIC_MODE = 'static';
const FORM_COLUMN_MODE = 'formColumn';

const cleanObject = (obj) => {
  const result = {};
  Object.entries(obj || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    result[key] = value;
  });
  return result;
};

const Properties = ({ field, updateField, appId, currentFormId }) => {
  const properties = field.properties || {};
  const options = Array.isArray(properties.options) ? properties.options : [];
  const optionsSourceRaw = properties.optionsSource;
  const currentOptionsSource =
    optionsSourceRaw && typeof optionsSourceRaw === 'object'
      ? optionsSourceRaw
      : { mode: STATIC_MODE };

  const mergeProperties = (patch) => {
    updateField(field.id, { ...properties, ...patch }, 'properties');
  };

  const updateOptions = (nextOptions) => {
    mergeProperties({ options: nextOptions });
  };

  const setOptionsSource = (patch) => {
    const merged = cleanObject({ ...currentOptionsSource, ...patch });
    if (!merged.mode) {
      merged.mode = STATIC_MODE;
    }
    mergeProperties({ optionsSource: merged });
  };

  const handleAddOption = () => {
    const next = [
      ...options,
      { label: `选项${options.length + 1}`, value: `option${options.length + 1}` },
    ];
    updateOptions(next);
  };

  const handleRemoveOption = (index) => {
    const next = options.filter((_, idx) => idx !== index);
    updateOptions(next);
  };

  const handleOptionChange = (index, key, value) => {
    const next = options.map((opt, idx) => (idx === index ? { ...opt, [key]: value } : opt));
    updateOptions(next);
  };

  const handleBasicChange = (key, value) => {
    mergeProperties({ [key]: value });
  };

  const validation = field.validation || {};
  const updateValidation = (patch) => {
    const next = { ...validation, ...patch };
    Object.keys(next).forEach((k) => {
      if (next[k] === undefined || next[k] === null || next[k] === '') {
        delete next[k];
      }
    });
    updateField(field.id, next, 'validation');
  };

  const mode = currentOptionsSource.mode || STATIC_MODE;
  const switchMode = (nextMode) => {
    if (nextMode === FORM_COLUMN_MODE) {
      setOptionsSource({
        mode: FORM_COLUMN_MODE,
        appId,
        formId: currentOptionsSource.formId,
        fieldId: currentOptionsSource.fieldId,
      });
    } else {
      setOptionsSource({ mode: STATIC_MODE });
    }
  };

  return (
    <>
      <SectionHeader title="属性" />
      <Form.Item label="字段 ID">
        <Input value={field.id} disabled style={{ background: '#fafafa' }} />
      </Form.Item>
      <Form.Item label="标题">
        <Input.TextArea
          value={properties.label}
          onChange={(e) => handleBasicChange('label', e.target.value)}
          rows={3}
        />
      </Form.Item>
      <Form.Item label="提示文字">
        <Input
          value={properties.placeholder}
          onChange={(e) => handleBasicChange('placeholder', e.target.value)}
        />
      </Form.Item>

      <SectionHeader title="选项来源" />
      <Form.Item label="模式">
        <Select
          value={mode}
          onChange={switchMode}
          options={[
            { value: STATIC_MODE, label: '手动维护' },
            { value: FORM_COLUMN_MODE, label: '引用表单数据' },
          ]}
        />
      </Form.Item>

      {mode === FORM_COLUMN_MODE && (
        <FormFieldSourceSelector
          appId={appId}
          value={{
            formId: currentOptionsSource.formId,
            fieldId: currentOptionsSource.fieldId,
          }}
          onChange={({ formId, fieldId }) =>
            setOptionsSource({
              mode: FORM_COLUMN_MODE,
              appId,
              formId,
              fieldId,
            })
          }
          formLabel={
            <Space size={4} align="center">
              <span>选择表单</span>
              <Tooltip title="从同一应用内其它表单的数据列生成选项，值将随数据自动更新。">
                <InfoCircleOutlined style={{ color: '#1677ff' }} />
              </Tooltip>
            </Space>
          }
          excludeFormIds={currentFormId ? [currentFormId] : undefined}
        />
      )}

      {mode === STATIC_MODE && (
        <Form.Item label="选项">
          {options.map((opt, index) => (
            <Space key={index} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
              <Input
                placeholder="选项名"
                value={opt.label}
                onChange={(e) => handleOptionChange(index, 'label', e.target.value)}
              />
              <Input
                placeholder="选项值"
                value={opt.value}
                onChange={(e) => handleOptionChange(index, 'value', e.target.value)}
              />
              <MinusCircleOutlined onClick={() => handleRemoveOption(index)} />
            </Space>
          ))}
          <Button type="dashed" onClick={handleAddOption} block icon={<PlusOutlined />}>
            添加选项
          </Button>
        </Form.Item>
      )}

      <SectionHeader title="校验" />
      <Form.Item>
        <Checkbox
          checked={validation.required === true}
          disabled={validation.unique === true}
          onChange={(e) => updateValidation({ required: e.target.checked })}
        >
          必填
        </Checkbox>
        <Checkbox
          checked={validation.unique === true}
          onChange={(e) => {
            if (e.target.checked) {
              updateValidation({ unique: true, required: true });
            } else {
              updateValidation({ unique: false });
            }
          }}
        >
          唯一
        </Checkbox>
      </Form.Item>
      <Form.Item label="特殊属性">
        <Checkbox
          checked={properties.readOnly === true}
          onChange={(e) => handleBasicChange('readOnly', e.target.checked)}
        >
          只读
        </Checkbox>
        <Checkbox
          checked={properties.hidden === true}
          onChange={(e) => handleBasicChange('hidden', e.target.checked)}
        >
          隐藏
        </Checkbox>
      </Form.Item>
    </>
  );
};

export default Properties;
