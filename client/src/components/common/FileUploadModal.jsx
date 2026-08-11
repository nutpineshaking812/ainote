import React, { useState } from 'react';
import { Modal, Upload, Button, message, Spin, Checkbox, Tag } from 'antd';
import { UploadOutlined } from '@ant-design/icons';

/**
 * FileUploadModal - A generic modal for uploading files.
 *
 * @param {boolean} visible - Modal visibility
 * @param {string} title - Modal title
 * @param {string} okText - Text for the OK button
 * @param {function} onCancel - Cancel callback
 * @param {function} onSuccess - Success callback (returns the result of uploadAction)
 * @param {function} uploadAction - The actual upload function (file, options) => Promise<any>
 * @param {string} accept - Accepted file types
 * @param {number} maxCount - Max number of files
 * @param {object} draggerProps - Additional props for Dragger
 * @param {boolean} showConvertOption - Whether to show "Convert to Document" checkbox
 * @param {boolean} defaultConvertToDocument - Default value for the checkbox
 */
const FileUploadModal = ({
  visible,
  title = '上传文件',
  okText = '开始上传',
  onCancel,
  onSuccess,
  uploadAction,
  accept,
  maxCount = 1,
  draggerProps = {},
  showConvertOption = false,
  defaultConvertToDocument = false,
  onConvertOptionChange,
  maxSize = 0,
}) => {
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [convertToDocument, setConvertToDocument] = useState(defaultConvertToDocument);

  const handleConvertOptionChange = (checked) => {
    setConvertToDocument(checked);
    if (onConvertOptionChange) {
      onConvertOptionChange(checked);
    }
  };

  const handleUpload = async () => {
    if (!fileList.length) {
      message.warning('请先选择文件');
      return;
    }

    if (!uploadAction) {
      console.error('[FileUploadModal] No uploadAction provided');
      return;
    }

    try {
      setUploading(true);
      const results = [];

      // Support uploading multiple files sequentially
      for (const file of fileList) {
        const result = await uploadAction(file.originFileObj, {
          convertToDocument,
          onProgress: (percent) => {
            // Optional: Handle individual file progress
          },
        });
        results.push(result);
      }

      message.success(fileList.length > 1 ? `成功上传 ${fileList.length} 个文件` : '上传成功');
      setFileList([]);

      // Return single result if maxCount is 1, otherwise return the array of results
      if (onSuccess) onSuccess(maxCount === 1 ? results[0] : results);
      if (onCancel) onCancel();
    } catch (err) {
      console.error('[FileUploadModal] Upload failed:', err);
      message.error(err.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open={visible}
      title={title}
      onCancel={onCancel}
      centered={true}
      onOk={handleUpload}
      okText={uploading ? <Spin size="small" /> : okText}
      okButtonProps={{ disabled: uploading }}
      cancelButtonProps={{ disabled: uploading }}
      destroyOnClose
    >
      <Upload.Dragger
        fileList={fileList}
        beforeUpload={() => false}
        onRemove={() => setFileList([])}
        onChange={({ fileList: newFileList }) => {
          const file = newFileList[newFileList.length - 1];
          if (maxSize > 0 && file && file.size > maxSize * 1024 * 1024) {
            message.error(`文件大小超过限制 (最大 ${maxSize}MB)`);
            return;
          }
          setFileList(newFileList.slice(-maxCount));
        }}
        accept={accept}
        maxCount={maxCount}
        disabled={uploading}
        {...draggerProps}
      >
        <p className="ant-upload-drag-icon">
          <UploadOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <div style={{ marginTop: 8 }}>
          {accept && (
            <Tag color="blue" style={{ marginBottom: 4 }}>
              支持格式: {accept}
            </Tag>
          )}
          {maxSize > 0 && <Tag color="orange">最大限制: {maxSize}MB</Tag>}
        </div>
      </Upload.Dragger>

      {showConvertOption && (
        <div style={{ marginTop: 16 }}>
          <Checkbox
            checked={convertToDocument}
            onChange={(e) => handleConvertOptionChange(e.target.checked)}
            disabled={uploading}
          >
            转为笔记
          </Checkbox>
        </div>
      )}
    </Modal>
  );
};

export default FileUploadModal;
