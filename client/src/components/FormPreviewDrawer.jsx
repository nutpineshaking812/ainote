import React from 'react';
import { Drawer, message } from 'antd';
import FormRenderer from './FormRenderer';
import { submitFormData } from '../api/data';

const FormPreviewDrawer = ({
  visible,
  onClose,
  formSchema,
  recordData,
  formId,
  allowSubmit = false,
  onSubmitted,
  submitHandler,
}) => {
  const fid = formId || formSchema?.id || formSchema?._id;

  const handleSubmit = async (values) => {
    if (!fid) {
      message.error('无法找到表单 ID，无法提交');
      return;
    }
    try {
      if (submitHandler && typeof submitHandler === 'function') {
        await submitHandler(fid, values);
      } else {
        await submitFormData(fid, values);
      }
      message.success('表单提交成功');
      if (onSubmitted) onSubmitted(values);
      onClose();
    } catch (err) {
      console.error('提交失败', err);
      message.error('表单提交失败');
      throw err;
    }
  };

  return (
    <Drawer
      title={formSchema?.name ? `${formSchema.name} - 预览` : '预览'}
      placement="bottom"
      height={520}
      onClose={onClose}
      open={visible}
    >
      <FormRenderer
        form={formSchema}
        appId={formSchema?.appId || formSchema?.appID}
        initialValues={recordData}
        hideActions={!allowSubmit}
        align="center"
        onSubmit={allowSubmit ? handleSubmit : undefined}
      />
    </Drawer>
  );
};

export default FormPreviewDrawer;
