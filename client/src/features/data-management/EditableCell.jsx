import React, { useState, useRef, useEffect } from 'react';
import {
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  Checkbox,
  Radio,
  Tooltip,
  Button,
} from 'antd';
import { EditOutlined } from '@ant-design/icons';

// Generic editable table cell used in DataManagementPage
// Props: editing, record, fieldDef, dataIndex, children, startEditCell, saveEditCell, cancelEditCell
// Revised: remove onBlur save (could capture stale value for composite pickers), use component-specific onChange + Enter key
const EditableCell = ({
  editing,
  record,
  fieldDef,
  dataIndex,
  children,
  startEditCell,
  saveEditCell,
  cancelEditCell,
  ...restProps
}) => {
  const labelText = fieldDef?.properties?.label || dataIndex;
  const validation = fieldDef?.validation || {};
  const rules = [{ required: validation.required === true, message: `请输入 ${labelText}` }];
  const patternString = typeof validation.pattern === 'string' ? validation.pattern : undefined;
  if (patternString && fieldDef?.type && !['date-picker', 'number'].includes(fieldDef.type)) {
    try {
      rules.push({ pattern: new RegExp(patternString), message: `${labelText} 格式不正确` });
    } catch {
      /* ignore invalid regex */
    }
  }
  const options = Array.isArray(fieldDef?.properties?.options)
    ? fieldDef.properties.options.map((o) => ({ label: o.label, value: o.value }))
    : [];

  const [hovered, setHovered] = useState(false);
  const debounceRef = useRef();
  const originalRawRef = useRef();
  const originalNormRef = useRef();
  const formInstance = Form.useFormInstance ? Form.useFormInstance() : null;

  // Normalization util (stable reference inside component)
  const normalize = (val, orig) => {
    if (fieldDef?.type === 'date-picker' && val) {
      const wasDateOnly = typeof orig === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(orig);
      if (val?.isValid && val.isValid())
        return wasDateOnly ? val.format('YYYY-MM-DD') : val.toDate().toISOString();
      if (val?.$d) {
        try {
          const d = new Date(val.$d);
          return wasDateOnly ? d.toISOString().slice(0, 10) : d.toISOString();
        } catch {
          return val;
        }
      }
      if (val instanceof Date)
        return wasDateOnly ? val.toISOString().slice(0, 10) : val.toISOString();
    }
    if ((fieldDef?.type === 'checkbox-group' || fieldDef?.type === 'dropdown-checkbox') && val) {
      const arr = Array.isArray(val) ? val : [val];
      const filtered = Array.from(
        new Set(arr.filter((v) => v !== undefined && v !== null && v !== '')),
      );
      return JSON.stringify(filtered);
    }
    return val;
  };

  // Capture original value once when entering edit mode
  useEffect(() => {
    if (editing) {
      const raw = record ? record[dataIndex] : formInstance?.getFieldValue(dataIndex);
      originalRawRef.current = raw;
      originalNormRef.current = normalize(raw, raw);
    }
  }, [editing, record, dataIndex, formInstance]);

  // Unified save scheduler; if val provided use it (for DatePicker / Select etc.)
  const scheduleSave = (val) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      let currentVal;
      try {
        if (val !== undefined) {
          // For Input events get target.value
          if (val && val.target) currentVal = val.target.value;
          else currentVal = val;
          if (formInstance) formInstance.setFieldsValue({ [dataIndex]: currentVal });
        } else {
          currentVal = formInstance ? formInstance.getFieldValue(dataIndex) : undefined;
        }
        const normCurrent = normalize(currentVal, originalRawRef.current);
        if (normCurrent === originalNormRef.current) {
          cancelEditCell();
          return;
        }
      } catch {
        /* ignore compare errors */
      }
      saveEditCell(record.id, dataIndex);
    }, 40);
  };

  // Outside click detection (since some antd components don't emit reliable onBlur)
  const cellRef = useRef(null);
  useEffect(() => {
    if (!editing) return;
    const handleDocMouseDown = (e) => {
      const t = e.target;
      if (!cellRef.current) return;
      if (
        t.closest?.('.ant-picker-dropdown') ||
        t.closest?.('.ant-select-dropdown') ||
        t.closest?.('.ant-dropdown') ||
        t.closest?.('.ant-time-picker-panel')
      )
        return;
      if (!cellRef.current.contains(t)) {
        //     // click outside the cell while editing -> attempt save
        // console.log('outside click detected');
        scheduleSave();
      }
    };
    document.addEventListener('mousedown', handleDocMouseDown);
    return () => document.removeEventListener('mousedown', handleDocMouseDown);
  }, [editing]);

  if (!editing) {
    // Reserve space permanently (paddingRight) so when icon fades in there's no layout shift.
    // Use absolute positioned action holder to avoid affecting text width calculations / ellipsis.
    const ACTION_WIDTH = 22; // approximate width of small text button
    const baseStyle = {
      position: 'relative',
      cursor: fieldDef ? 'pointer' : 'default',
      paddingRight: ACTION_WIDTH + 6, // reserve space (button + small gap)
    };
    // console.log('EditableCell render read mode for', restProps.style);
    const mergedStyle = { ...baseStyle };
    return (
      <td
        {...restProps}
        // style={mergedStyle}
        onDoubleClick={() => startEditCell(record, fieldDef)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={{ width: '100%', display: 'flex' }}>
          <div
            style={{
              // width: '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {children}
          </div>
          {fieldDef && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 2,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                opacity: hovered ? 1 : 0,
                transition: 'opacity 120ms ease-in-out',
              }}
            >
              <Tooltip title="编辑(双击单元格或点此)">
                <Button
                  size="small"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => startEditCell(record, fieldDef)}
                  style={{ padding: 0, width: ACTION_WIDTH, minWidth: ACTION_WIDTH }}
                />
              </Tooltip>
            </div>
          )}
        </div>
      </td>
    );
  }

  let inputNode;
  switch (fieldDef?.type) {
    case 'number':
      inputNode = (
        <InputNumber
          style={{ width: '100%' }}
          onBlur={() => scheduleSave()}
          onPressEnter={() => scheduleSave()}
        />
      );
      break;
    case 'date-picker':
      inputNode = (
        <DatePicker
          style={{ width: '100%' }}
          format="YYYY-MM-DD"
          onChange={(dayjsVal) => scheduleSave(dayjsVal)}
          onOpenChange={(open) => {
            if (!open) scheduleSave();
          }}
        />
      );
      break;
    case 'radio-group':
      inputNode = (
        <Radio.Group
          options={options}
          optionType="button"
          size="small"
          onChange={(e) => scheduleSave(e)}
          onBlur={() => scheduleSave()}
        />
      );
      break;
    case 'dropdown':
      inputNode = (
        <Select
          options={options}
          size="small"
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          onChange={(val) => scheduleSave(val)}
        />
      );
      break;
    case 'checkbox-group':
      inputNode = (
        <Checkbox.Group
          options={options}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}
          onBlur={() => scheduleSave()}
        />
      );
      break;
    case 'dropdown-checkbox':
      inputNode = (
        <Select
          mode="multiple"
          options={options}
          size="small"
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          maxTagCount="responsive"
          onBlur={() => scheduleSave()}
        />
      );
      break;
    case 'textarea':
      inputNode = (
        <Input.TextArea
          autoSize={{ minRows: 1, maxRows: 4 }}
          size="small"
          onBlur={() => scheduleSave()}
        />
      );
      break;
    default:
      inputNode = (
        <Input
          size="small"
          placeholder={labelText}
          onBlur={() => scheduleSave()}
          onPressEnter={() => scheduleSave()}
        />
      );
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      if (fieldDef?.type === 'textarea' && !e.ctrlKey) return;
      saveEditCell(record.id || record._id, dataIndex);
    } else if (e.key === 'Escape') cancelEditCell();
  };

  const editBaseStyle = { background: '#fffbe6' };
  const mergedEditStyle = { ...restProps.style, ...editBaseStyle };
  return (
    <td {...restProps} style={mergedEditStyle} ref={cellRef}>
      <Form.Item name={dataIndex} style={{ margin: 0 }} rules={rules}>
        {React.cloneElement(inputNode, {
          autoFocus: true,
          onKeyDown: handleKey,
        })}
      </Form.Item>
    </td>
  );
};

export default EditableCell;
