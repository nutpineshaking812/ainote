import { createInlineContentSpec } from '@blocknote/core';

export const createDocMentionConfig = {
  type: 'docMention',
  propSchema: {
    docId: { type: 'string', default: '' },
    title: { type: 'string', default: '未命名文件' },
    type: { type: 'string', default: 'document' },
  },
  content: 'none',
};

const createDocMentionImplementation = (dependencies = {}) => {
  const { React, createRoot, CustomDocMentionView, serverRuntime = false } = dependencies;
  const canRender =
    typeof document !== 'undefined' &&
    typeof createRoot === 'function' &&
    typeof React?.createElement === 'function' &&
    CustomDocMentionView && !serverRuntime;

  return {
    render(inlineContent, editor) {
      const dom = document.createElement('span');
      dom.className = 'bn-custom-doc-mention-wrapper';

      if (!canRender) {
        dom.textContent = `@${inlineContent.props.title || '未命名文件'}`;
        return {
          dom,
          destroy() {},
        };
      }

      const root = createRoot(dom);
      const renderView = (contentState) => {
        const element = React.createElement(CustomDocMentionView, {
          inlineContent: contentState,
          editor: editor,
        });
        root.render(element);
      };

      renderView(inlineContent);

      return {
        dom,
        update(updatedInlineContent) {
          if (updatedInlineContent.type !== 'docMention') {
            return false;
          }
          renderView(updatedInlineContent);
          return true;
        },
        destroy() {
          root.unmount();
        },
      };
    },
    toExternalHTML(inlineContent) {
      const { docId, title, type } = inlineContent.props;
      if (serverRuntime && docId) {
        let prefix = type || 'document';
        if (prefix === 'document') {
          prefix = 'doc';
        }
        let cleanDocId = docId;
        if (cleanDocId.startsWith(`${prefix}:`)) {
          cleanDocId = cleanDocId.substring(prefix.length + 1);
        }
        const defaultTitles = {
          document: '未命名文档',
          doc: '未命名文档',
          tool: '未命名工具',
          mcp: '未命名外部插件',
          form: '未命名表单',
          view: '未命名视图',
        };
        const defaultTitle = defaultTitles[prefix] || '未命名文件';
        return {
          dom: document.createTextNode(`[SKILL_REF: ${prefix}:${cleanDocId} | ${title || defaultTitle}]`),
        };
      }

      const anchor = document.createElement('a');
      anchor.href = `app#/${type}/${docId}`;
      anchor.className = 'bn-custom-doc-mention-external';
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = `@${title || '未命名文件'}`;

      return { dom: anchor };
    },
  };
};

export const createDocMention = (dependencies) =>
  createInlineContentSpec(createDocMentionConfig, createDocMentionImplementation(dependencies));

export const DocMentionInline = (dependencies) => createDocMention(dependencies);

export default createDocMention;
