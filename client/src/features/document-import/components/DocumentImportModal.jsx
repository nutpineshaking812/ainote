import React, { useState } from 'react';
import { message } from 'antd';
import { useCreateBlockNote } from '@blocknote/react';
import FileUploadModal from '../../../components/common/FileUploadModal';
import { markitdownUpload } from '../../../api/upload';
import { createDocument } from '../../../api/documents';
import { addResource } from '../../../api/resources';
import useAppStore from '../../../store/useAppStore';

/**
 * DocumentImportModal - Business component for importing external files as documents.
 */
const DocumentImportModal = ({ visible, node, onCancel, onSuccess }) => {
  const blockNote = useCreateBlockNote();
  const currentAppId = useAppStore((state) => state.currentAppId);
  const [convertToDocument, setConvertToDocument] = useState(false);

  const handleUploadAction = async (fileObj, opts) => {
    const appId = currentAppId || node?.data?.appId;
    if (!appId) {
      throw new Error('无法确定所属的应用 ID (appId)');
    }

    const convert = opts?.convertToDocument ?? true;
    const targetId = node?.data?.id || node?.data?._id || node?.key || '';

    if (convert) {
      // 1. Upload and convert using MarkItDown service
      const data = await markitdownUpload(fileObj, targetId, {
        usageType: 'document_import',
        usageId: appId,
      });

      if (!data || !data.content) {
        throw new Error('解析内容为空');
      }

      // 2. Parse content to BlockNote blocks
      const blocks =
        data.format === 'html'
          ? blockNote.tryParseHTMLToBlocks(data.content)
          : blockNote.tryParseMarkdownToBlocks(data.content);

      // 3. Enrich with original file metadata
      if (data.originalFile?.id) {
        const fileId = data.originalFile.id;
        const fileName = data.originalFile.name || fileObj.name;

        for (const b of blocks) {
          if (b.type === 'title') {
            b.props = { ...b.props, originalFileId: fileId, originalFileName: fileName };
            break;
          }
        }
      }

      // 4. Create the actual document
      const payload = {
        title: fileObj.name,
        blocks,
        attachments: [],
        tags: [],
        parentId: targetId,
        originalFileId: data.originalFile?.id,
      };

      const resultDoc = await createDocument(payload, { appId });
      return resultDoc?.data || resultDoc;
    } else {
      // Pure file upload logic
      const { uploadAttachment } = await import('../../../api/upload');
      const fileInfo = await uploadAttachment(fileObj, {
        usageType: 'document_import',
        usageId: appId,
      });

      // Determine resource type from extension
      const ext = fileObj.name.split('.').pop().toLowerCase();

      const payload = {
        type: ext, // e.g. 'pdf'
        refId: fileInfo.id,
        parentId: targetId,
        meta: {
          name: fileObj.name,
          desc: '',
        },
      };

      const result = await addResource(appId, payload);
      return result;
    }
  };

  return (
    <FileUploadModal
      visible={visible}
      title="上传文件"
      okText="确认上传"
      accept={convertToDocument ? '.md,.markdown,.txt,.docx,.pdf' : '*'}
      onCancel={onCancel}
      uploadAction={handleUploadAction}
      onSuccess={onSuccess}
      // showConvertOption={node?.data.type === 'folder'}
      showConvertOption={true}
      defaultConvertToDocument={false}
      onConvertOptionChange={setConvertToDocument}
      maxSize={50}
    />
  );
};

export default DocumentImportModal;
