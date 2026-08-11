import React, { useEffect, useRef, useState, useCallback } from 'react';

const InlineEditableTitle = ({ value, defaultValue = '新表单', onChange, disabled = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value || defaultValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isEditing) {
      setDraft(value || defaultValue);
    }
  }, [isEditing, value, defaultValue]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commit = useCallback(
    (nextValue) => {
      const trimmed = (nextValue || '').trim().slice(0, 15);
      const finalValue = trimmed || defaultValue;
      onChange?.(finalValue);
      setDraft(finalValue);
      setIsEditing(false);
    },
    [defaultValue, onChange],
  );

  const cancel = useCallback(() => {
    setDraft(value || defaultValue);
    setIsEditing(false);
  }, [defaultValue, value]);

  const displayText = value || defaultValue;
  const measuredLength = (isEditing ? draft : displayText).length || 1;
  const inputWidth = `${Math.max(measuredLength, 2)}ch`;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
      {isEditing ? (
        <input
          ref={inputRef}
          value={draft}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value.slice(0, 15);
            setDraft(next);
          }}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(draft);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            }
          }}
          style={{
            fontSize: 16,
            fontWeight: 500,
            border: 'none',
            outline: 'none',
            borderBottom: '1px dashed #1677ff',
            padding: 0,
            cursor: disabled ? 'not-allowed' : 'text',
            background: 'transparent',
            lineHeight: '24px',
            color: '#1f1f1f',
            minWidth: 80,
            width: inputWidth,
            maxWidth: '100%',
          }}
        />
      ) : (
        <span
          onClick={() => {
            if (!disabled) setIsEditing(true);
          }}
          style={{
            fontSize: 16,
            fontWeight: 500,
            cursor: disabled ? 'default' : 'text',
            borderBottom: '1px dashed transparent',
            lineHeight: '24px',
            color: '#1f1f1f',
            display: 'inline-flex',
            alignItems: 'center',
            minWidth: 80,
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (!disabled) e.currentTarget.style.borderBottomColor = '#d9d9d9';
          }}
          onMouseLeave={(e) => {
            if (!disabled) e.currentTarget.style.borderBottomColor = 'transparent';
          }}
          title={disabled ? '' : '点击编辑表单名称'}
        >
          {displayText}
        </span>
      )}
    </div>
  );
};

export default InlineEditableTitle;
