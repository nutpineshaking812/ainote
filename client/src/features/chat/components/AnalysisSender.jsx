import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Sender, Suggestion } from '@ant-design/x';
import {
  SendOutlined,
  TableOutlined,
  NumberOutlined,
  CalendarOutlined,
  FontSizeOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { Space, Typography } from 'antd';
import { getFormsByAppId } from '../../../api/forms';

const SmartSender = ({
  disabled,
  loading,
  onSubmit,
  placeholder = '输入内容，输入 @ 选择字段，输入 / 获取建议',
  appId, // 当前应用ID
}) => {
  const [value, setValue] = useState('');
  const [forms, setForms] = useState([]); // 存储表单列表
  const [selectedForms, setSelectedForms] = useState([]); // 当前选中的表单列表
  const [suggestionOpen, setSuggestionOpen] = useState(false);

  // 加载表单列表
  const loadForms = useCallback(async () => {
    try {
      const forms = await getFormsByAppId(appId);
      setForms(forms || []);
    } catch (error) {
      console.error('Failed to load forms:', error);
    }
  }, [appId]);

  // 所有的建议项
  const allSuggestions = useMemo(
    () => [
      {
        label: '数据表单',
        value: 'forms',
        icon: <TableOutlined />,
        children: forms.map((form) => ({
          label: form.name,
          value: form._id,
          description: '选择此表单',
        })),
      },
    ],
    [forms],
  );

  const handleSelect = useCallback((suggestion, path) => {
    setValue((prev) => {
      const lastChar = prev.slice(-1);

      // 如果选择的是表单
      if (path[0] === 'forms') {
        setSelectedForm(suggestion.value);
        // 删除触发字符 @，因为我们要等待用户再次输入 @ 来选择字段
        return prev.slice(0, -1);
      }

      if (lastChar === '@' || lastChar === '/') {
        return prev + suggestion.value + ' ';
      }
      // 如果不是以触发字符结尾，追加一个空格
      return prev + ' ' + suggestion.value + ' ';
    });
  }, []);

  // 处理发送
  const handleSubmit = useCallback(
    (text) => {
      if (suggestionOpen) return;
      // console.log('Submitting text:', text);
      setValue('');
      setSelectedForms([]);
      onSubmit?.(text);
    },
    [onSubmit],
  );

  // 已选择的表单列表组件
  const headerNode = useMemo(() => {
    if (!selectedForms.length) return null;
    const selectedFormObjects = selectedForms
      .map((id) => forms.find((f) => f._id === id))
      .filter(Boolean);

    if (!selectedFormObjects.length) return null;

    return (
      <Sender.Header
        open={true}
        title={
          <Space wrap>
            {selectedFormObjects.map((form) => (
              <Space
                key={form._id}
                style={{
                  background: '#f0f0f0',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  marginRight: 8,
                }}
              >
                <TableOutlined />
                <Typography.Text type="secondary">{form.name}</Typography.Text>
                <DeleteOutlined
                  style={{ cursor: 'pointer', color: '#999' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedForms((prev) => prev.filter((id) => id !== form._id));
                  }}
                />
              </Space>
            ))}
          </Space>
        }
      />
    );
  }, [selectedForms, forms]);

  return (
    <Suggestion
      items={allSuggestions}
      onSelect={(itemVal) => {
        if (itemVal) {
          // 添加到已选表单列表，避免重复
          setSelectedForms((prev) => {
            if (prev.includes(itemVal)) return prev;
            return [...prev, itemVal];
          });
          const form = forms.find((f) => f._id === itemVal);
          setValue(value + '"' + form.name + '" ');
        }
      }}
      onOpenChange={setSuggestionOpen}
      style={{ maxHeight: '40vh', overflow: 'auto' }}
    >
      {({ onTrigger, onKeyDown }) => (
        <Sender
          value={value}
          header={headerNode}
          onChange={(nextVal) => {
            // 检查是否触发建议
            const lastChar = nextVal.slice(-1);
            if (lastChar === '@' || lastChar === '/') {
              // 如果是 @ 且还没有选择表单，加载表单列表
              if (lastChar === '@' && forms.length === 0) {
                loadForms();
              }
              onTrigger();
            } else if (!nextVal) {
              onTrigger(false);
              // 清空所有选中的表单
              setSelectedForms([]);
            }
            setValue(nextVal);
          }}
          onKeyDown={onKeyDown}
          disabled={disabled}
          loading={loading}
          onSubmit={!suggestionOpen ? handleSubmit : undefined}
          placeholder={placeholder}
          sendButtonProps={{
            icon: <SendOutlined />,
            type: 'primary',
          }}
        />
      )}
    </Suggestion>
  );
};

export default SmartSender;
