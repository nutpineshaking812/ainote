import React from 'react';
import { BlockNoteEditor } from '../../../../components/blocknote';

export default function DocumentEditorPanel({
  appId,
  loading,
  title,
  content,
  setTitle,
  setContent,
  saving,
  withTitle = false,
  extraListItems = [],
  height = 520, // 可通过父组件样式或传入覆盖
  usageId,
}) {
  // console.log('DocumentEditorPanel render', {
  //   loading,
  //   title,
  //   content,
  //   saving,
  //   withTitle,
  //   extraListItems,
  //   height,
  // });
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {loading ? (
        <div
          style={{
            flex: 1,
            height: typeof height === 'string' ? height : `${height}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#bfbfbf',
          }}
        >
          加载文档内容...
        </div>
      ) : (
        <BlockNoteEditor
          appId={appId}
          title={title}
          initialBlocks={content}
          onTitleChange={setTitle}
          onChange={(md) => setContent(md)}
          height={height}
          readOnly={loading}
          placeholder="开始书写你的想法..."
          withTitle={withTitle}
          childDocs={extraListItems}
          usageId={usageId}
        />
      )}
    </div>
  );
}
