import React from 'react';
import { Typography, Spin } from 'antd';
import FormRenderer from '../../../components/FormRenderer';
import dayjs from 'dayjs';

const { Text } = Typography;

/**
 * RecordPreviewCard - 可复用的记录预览卡片组件
 * 使用 FormRenderer 以表单形式展示记录数据，支持日期字段规范化
 *
 * @param {Object} formSchema - 表单结构定义（包含 fields 数组）
 * @param {Object} record - 要展示的记录数据
 * @param {Boolean} loading - 是否正在加载表单结构
 * @param {String} align - FormRenderer 对齐方式，默认 'left'
 * @param {Object} style - 自定义外层容器样式
 */
const RecordPreviewCard = ({ formSchema, record, loading = false, align = 'left', style = {} }) => {
  // 处理记录数据：合并 record.data 与元数据，并规范化日期字段
  const processRecordForDisplay = () => {
    if (!record || !formSchema) return {};

    // 基础数据合并（假设 API 返回的记录格式可能包含 data 字段或直接是数据）
    const baseData = record.data || record;
    const processed = { ...baseData };

    // 规范化日期字段为 dayjs 对象（FormRenderer 的 DatePicker 需要）
    formSchema.fields?.forEach((field) => {
      if (field.type === 'date-picker' && processed[field.id]) {
        const val = processed[field.id];
        if (typeof val === 'string' && val) {
          processed[field.id] = dayjs(val);
        }
      }
    });

    return processed;
  };

  const defaultStyle = {
    border: '1px solid #f0f0f0',
    borderRadius: 6,
    padding: 16,
    background: '#fafafa',
    ...style,
  };

  return (
    <div style={defaultStyle}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin tip="加载表单结构中..." />
        </div>
      ) : formSchema ? (
        <FormRenderer
          form={formSchema}
          initialValues={processRecordForDisplay()}
          hideActions={true}
          align={align}
          appId={formSchema?.appId}
        />
      ) : (
        <Text type="secondary">表单结构加载失败</Text>
      )}
    </div>
  );
};

export default RecordPreviewCard;
