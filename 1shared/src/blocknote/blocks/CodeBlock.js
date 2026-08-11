import { createBlockConfig, createBlockSpec } from '@blocknote/core';
import { DOMParser } from 'prosemirror-model';


export const getBlockText = (b) => {
  if (!b.content) return '';
  if (typeof b.content === 'string') return b.content;
  if (Array.isArray(b.content)) {
    return b.content.map(node => node.text || '').join('');
  }
  return '';
};

const createCodeBlockConfig = createBlockConfig(() => ({
  type: 'codeBlock',
  content: 'inline', // 开启行内文本支持，实现与 BlockNote 标准数据结构 100% 完美兼容！
  propSchema: {
    language: { type: 'string', default: 'javascript' },
    viewMode: { type: 'string', default: 'edit' },
  },
}));

const ensureDom = () => {
  if (typeof document !== 'undefined') {
    const node = document.createElement('div');
    node.className = 'bn-custom-code-block';
    return node;
  }
  return {
    nodeName: 'DIV',
    className: 'bn-custom-code-block',
    dataset: {},
    contains: () => false,
  };
};

const ensureDataset = (dom) => {
  if (dom && typeof dom === 'object' && dom.dataset === undefined) {
    Object.defineProperty(dom, 'dataset', {
      value: {},
      writable: true,
      enumerable: false,
      configurable: true,
    });
  }
};

const createCodeBlockImplementation = (dependencies = {}) => {
  const { React, createRoot, CustomCodeBlockView } = dependencies;
  const canRender =
    typeof document !== 'undefined' &&
    typeof createRoot === 'function' &&
    typeof React?.createElement === 'function' &&
    CustomCodeBlockView;

  return {
    meta: {
      selectable: true,
      isolating: false,
      code: true,
      defining: true,
    },
    parse: (e) => {
      console.log('[CodeBlock parse] Element tag:', e.tagName, 'outerHTML:', e.outerHTML?.slice(0, 200));
      if (e.tagName !== 'PRE') {
        return undefined;
      }

      if (
        e.childElementCount !== 1 ||
        e.firstElementChild?.tagName !== 'CODE'
      ) {
        console.log('[CodeBlock parse] PRE tag lacks single CODE child', e.childElementCount, e.firstElementChild?.tagName);
        return undefined;
      }

      const code = e.firstElementChild;
      const language =
        code.getAttribute('data-language') ||
        code.className
          .split(' ')
          .find((name) => name.includes('language-'))
          ?.replace('language-', '');

      console.log('[CodeBlock parse] Matched PRE -> language:', language);
      return { language };
    },
    parseContent: ({ el, schema }) => {
      console.log('[CodeBlock parseContent] el:', el.tagName, 'firstElementChild:', el.firstElementChild?.tagName, 'outerHTML:', el.outerHTML?.slice(0, 200));
      const parser = DOMParser.fromSchema(schema);
      const code = el.firstElementChild;
      if (!code) {
        console.warn('[CodeBlock parseContent] WARNING: code element is null!');
      }

      try {
        const result = parser.parse(code, {
          preserveWhitespace: 'full',
          topNode: schema.nodes['codeBlock'].create(),
        }).content;
        console.log('[CodeBlock parseContent] parsed successfully, result size:', result.size);
        return result;
      } catch (err) {
        console.error('[CodeBlock parseContent] CRASH inside parser.parse:', err);
        throw err;
      }
    },
    render(block, editor) {
      const dom = ensureDom();
      ensureDataset(dom);

      let contentDOM;
      if (typeof document !== 'undefined') {
        contentDOM = document.createElement('div');
        contentDOM.className = 'bn-inline-content';
        contentDOM.style.display = 'none';
        dom.appendChild(contentDOM);
      }

      if (!canRender) {
        dom.dataset.empty = 'true';
        return {
          dom,
          contentDOM,
          destroy() {},
          update(updatedBlock) {
            return updatedBlock.type === 'codeBlock';
          },
          ignoreMutation() {
            return true;
          },
        };
      }

      let currentBlock = { ...block };
      const root = createRoot(dom);

      const renderView = (blockState) => {
        const element = React.createElement(CustomCodeBlockView, {
          block: blockState,
          editor: editor,
        });
        root.render(element);
      };

      renderView(currentBlock);

      return {
        dom,
        contentDOM,
        update(updatedBlock) {
          if (updatedBlock.type !== 'codeBlock') {
            return false;
          }
          currentBlock = { ...updatedBlock };
          renderView(currentBlock);
          return true;
        },
        destroy() {
          root.unmount();
        },
         ignoreMutation(mutation) {
          if (contentDOM && contentDOM.contains(mutation.target)) {
            return false;
          }
          return dom.contains?.(mutation.target);
        },
      };
    },
    toExternalHTML(block) {
      if (typeof document === 'undefined') {
        const text = getBlockText(block);
        return {
          dom: {
            nodeName: 'PRE',
            textContent: text,
          },
        };
      }
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.className = `language-${block.props.language ?? 'javascript'}`;
      pre.appendChild(code);
      return {
        dom: pre,
        contentDOM: code,
      };
    },
  };
};

export const createCodeBlock = (dependencies) =>
  createBlockSpec(createCodeBlockConfig, () => createCodeBlockImplementation(dependencies));

export const CodeBlock = (dependencies) => createCodeBlock(dependencies)();

export default createCodeBlock;
