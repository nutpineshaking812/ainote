import React, { useEffect, useMemo, useState } from 'react';
import { Form, Select, Space, Typography, Spin } from 'antd';
import { getFormsByAppId, getForm } from '../../../../api/forms';

const { Text } = Typography;

const FormFieldSourceSelector = ({
  appId,
  value,
  onChange,
  disabled,
  formLabel = '选择表单',
  fieldLabel = '选择字段',
  excludeFormIds,
}) => {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formFields, setFormFields] = useState([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setForms([]);
    setError(null);

    if (!appId) {
      return () => {
        isMounted = false;
      };
    }

    setLoading(true);
    getFormsByAppId(appId)
      .then((list) => {
        if (!isMounted) return;
        setForms(Array.isArray(list) ? list : []);
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to load forms for selector', err);
        if (isMounted) {
          setError('加载表单列表失败');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [appId]);

  useEffect(() => {
    let isMounted = true;
    if (!value?.formId || !appId) {
      setFormFields([]);
      return;
    }

    setFieldsLoading(true);
    getForm(appId, value.formId)
      .then((data) => {
        if (!isMounted) return;
        setFormFields(data?.fields || []);
      })
      .catch((err) => {
        console.error('Failed to load fields for form', err);
      })
      .finally(() => {
        if (isMounted) setFieldsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [value?.formId, appId]);

  const excludedIdsSet = useMemo(() => {
    if (!Array.isArray(excludeFormIds)) return new Set();
    return new Set(excludeFormIds.filter(Boolean));
  }, [excludeFormIds]);

  const availableForms = useMemo(() => {
    if (!Array.isArray(forms)) return [];
    return forms.filter((formDoc) => {
      const identifier = formDoc?._id || formDoc?.id;
      if (!identifier) return false;
      if (excludedIdsSet.has(identifier)) {
        return value?.formId === identifier;
      }
      return true;
    });
  }, [forms, excludedIdsSet, value?.formId]);

  const fieldOptions = useMemo(() => {
    if (!Array.isArray(formFields)) return [];
    return formFields
      .filter((field) => field && field.recordable !== false)
      .map((field) => ({
        value: field.id,
        label: field.properties?.label || field.id,
      }));
  }, [formFields]);

  const handleFormChange = (formId) => {
    onChange({ formId: formId || undefined, fieldId: undefined });
  };

  const handleFieldChange = (fieldId) => {
    onChange({ formId: value?.formId, fieldId: fieldId || undefined });
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="small">
      <Form.Item label={formLabel} required>
        <Select
          placeholder="请选择来源表单"
          value={value?.formId}
          onChange={handleFormChange}
          loading={loading}
          allowClear
          disabled={disabled || !appId}
        >
          {availableForms.map((formDoc) => {
            const identifier = formDoc?._id || formDoc?.id;
            if (!identifier) return null;
            return (
              <Select.Option key={identifier} value={identifier}>
                {formDoc?.name || identifier}
              </Select.Option>
            );
          })}
        </Select>
      </Form.Item>
      <Form.Item label={fieldLabel} required>
        <Select
          placeholder="请选择字段"
          value={value?.fieldId}
          onChange={handleFieldChange}
          disabled={disabled || !value?.formId}
          allowClear
        >
          {fieldOptions.map((option) => (
            <Select.Option key={option.value} value={option.value}>
              {option.label}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>
      {error && <Text type="danger">{error}</Text>}
      {!loading && value?.formId && fieldOptions.length === 0 && (
        <Text type="secondary">该表单暂无可用字段。</Text>
      )}
      {loading && (
        <div>
          <Spin size="small" />
        </div>
      )}
    </Space>
  );
};

export default FormFieldSourceSelector;
