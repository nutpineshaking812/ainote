import React, { useEffect, useMemo, useState } from 'react';
import { Select } from 'antd';
import { getFormFieldDistinctValues } from '../../../../api/data';

const buildOption = (raw) => ({
  label: String(raw),
  value: raw,
});

const Renderer = ({ field, value, onChange, appId, formId, disabled }) => {
  const properties = field.properties || {};
  const optionsSource = properties.optionsSource || {};
  const isDynamic = optionsSource.mode === 'formColumn';

  const resolvedAppId = optionsSource.appId || appId || field.appId || field.formAppId;
  const resolvedFormId = optionsSource.formId || formId || field.formId;
  const resolvedFieldId = optionsSource.fieldId;

  const shouldFetch = isDynamic && resolvedAppId && resolvedFormId && resolvedFieldId;

  const [dynamicValues, setDynamicValues] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!shouldFetch) {
      setDynamicValues([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      setLoading(true);
      try {
        const payload = await getFormFieldDistinctValues(resolvedFormId, resolvedFieldId);
        if (cancelled) return;
        const valuesArray = Array.isArray(payload?.values) ? payload.values : [];
        setDynamicValues(valuesArray);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load dynamic dropdown options', error);
          setDynamicValues([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [shouldFetch, resolvedAppId, resolvedFormId, resolvedFieldId]);

  const finalOptions = useMemo(() => {
    if (shouldFetch) {
      return dynamicValues.map(buildOption);
    }
    const staticOptions = Array.isArray(properties.options) ? properties.options : [];
    return staticOptions.map((opt) => ({ label: opt.label, value: opt.value }));
  }, [shouldFetch, dynamicValues, properties.options]);

  return (
    <Select
      placeholder={properties.placeholder}
      style={{ width: '100%' }}
      value={value}
      onChange={onChange}
      options={finalOptions}
      loading={loading}
      allowClear
      disabled={disabled}
    />
  );
};

export default Renderer;
