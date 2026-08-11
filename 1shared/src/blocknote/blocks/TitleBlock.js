import { createBlockConfig, createBlockSpec } from '@blocknote/core';
// const protectedTitlePlugin = new Plugin({
//   key: new PluginKey('prevent-title-deletion'),
//   filterTransaction: (tr, state) => {
//     // 1. 如果文档无变化，放行
//     if (!tr.docChanged) return true;

//     const BLOCK_NAME = 'title';

//     // 2. 检查变化前是否存在
//     let existsBefore = false;
//     state.doc.descendants((node) => {
//       if (node.type.name === BLOCK_NAME) {
//         existsBefore = true;
//         return false;
//       }
//       return true;
//     });
//     console.log('protectedTitlePlugin: existsBefore=', existsBefore);

//     if (!existsBefore) return true;

//     // 3. 检查变化后是否存在
//     let existsAfter = false;
//     tr.doc.descendants((node) => {
//       if (node.type.name === BLOCK_NAME) {
//         existsAfter = true;
//         return false;
//       }
//       return true;
//     });

//     // 4. 拦截
//     if (!existsAfter) {
//       // console.warn('🚫 拦截操作：TitleBlock 不允许被删除');
//       return false;
//     }

//     return true;
//   },
// })

const DEFAULT_PLACEHOLDER = 'New Page';

const createTitleBlockConfig = createBlockConfig(() => ({
  type: 'title',
  content: 'inline',
  propSchema: {
    id: { type: 'string', default: 'title-block' },
    placeholder: { type: 'string', default: '' },
    originalFileId: { type: 'string', default: '' },
    originalFileName: { type: 'string', default: '' },
  },
}));

const isTitleEmpty = (block) => {
  let content = block?.content;

  // 1. 如果是 ProseMirror Fragment 对象，取出内部的 content 数组
  if (content && typeof content === 'object' && !Array.isArray(content) && content.content) {
    content = content.content;
  }

  // 2. 确保 content 是数组，否则视为空
  const contentArray = Array.isArray(content) ? content : [];

  if (contentArray.length === 0) {
    return true;
  }

  if (contentArray.length === 1) {
    const node = contentArray[0];
    
    // 处理 ProseMirror Node (has isText property)
    if (node.isText) {
       return !(node.text || '').trim();
    }

    // 处理普通 JSON Node
    if (node.type === 'text') {
      return !(node.text || '').trim();
    }
    if (node.type === 'paragraph') {
      return !(node.content ?? []).length;
    }
  }
  return false;
};

const createDownloadIcon = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '64 64 896 896');
  svg.setAttribute('width', '1em');
  svg.setAttribute('height', '1em');
  svg.setAttribute('fill', 'currentColor');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M505.7 661a8 8 0 0012.6 0l112-141.7c4.1-5.2.4-12.9-6.3-12.9h-74.1V168c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v338.3H400c-6.7 0-10.4 7.7-6.3 12.9l112 141.8zM878 626h-60c-4.4 0-8 3.6-8 8v154H214V634c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v198c0 17.7 14.3 32 32 32h684c17.7 0 32-14.3 32-32V634c0-4.4-3.6-8-8-8z',
  );

  svg.appendChild(path);
  return svg;
};

const buildDownloadButton = () => {
  const container = document.createElement('div');
  container.className = 'bn-original-file';
  container.setAttribute('contenteditable', 'false');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'bn-original-file-btn';
  button.title = '下载原始文件';

  const iconWrapper = document.createElement('span');
  iconWrapper.className = 'bn-original-file-icon';
  iconWrapper.appendChild(createDownloadIcon());

  const label = document.createElement('span');
  label.className = 'bn-original-file-label';

  button.appendChild(iconWrapper);
  button.appendChild(label);
  container.appendChild(button);
  return { container, button, label };
};

const TitleBlock = createBlockSpec(createTitleBlockConfig, (options = {}) => ({
  meta: {
    selectable: true,
    defining: true,
  },
  render(block) {
    const {
      onDownload,
      onDownloadStart,
      onDownloadSuccess,
      onDownloadError,
      onDownloadFinally,
      shouldShowDownload,
    } = options;

    let currentBlock = block;
    let currentProps = { ...block.props };

    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '18px';
    wrapper.style.width = '100%';

    const content = document.createElement('div');
    content.className = 'bn-title-block bn-inline-content';

    const updatePlaceholder = () => {
      // const placeholder = (currentProps.placeholder || '').trim() || DEFAULT_PLACEHOLDER;

      content.dataset.placeholder = block.props.placeholder;
      content.dataset.empty = isTitleEmpty(currentBlock) ? 'true' : 'false';
      // console.log('content.dataset.empty', currentProps, block);
    };

    updatePlaceholder();

    const {
      container: downloadContainer,
      button: downloadButton,
      label: downloadLabel,
    } = buildDownloadButton();

    const computeShouldShowDownload = () => {
      const hasSource = Boolean(currentProps.originalFileId);
      const hasHandler = typeof onDownload === 'function';
      if (typeof shouldShowDownload === 'function') {
        try {
          return Boolean(
            shouldShowDownload({
              block: currentBlock,
              props: currentProps,
              hasSource,
              hasHandler,
            }),
          );
        } catch (error) {
          console.error('TitleBlock shouldShowDownload failed', error);
        }
      }
      return hasSource && hasHandler;
    };

    const refreshDownloadState = () => {
      const visible = computeShouldShowDownload();
      downloadContainer.style.display = visible ? 'flex' : 'none';
      downloadLabel.textContent = currentProps.originalFileName || '原始文件';
      downloadButton.setAttribute('aria-hidden', visible ? 'false' : 'true');
      downloadButton.tabIndex = visible ? 0 : -1;
      if (!visible) {
        downloadButton.disabled = true;
      } else if (!downloadButton.dataset.loading) {
        downloadButton.disabled = false;
      }
    };

    const buildDownloadContext = (event) => ({
      event,
      block: currentBlock,
      props: { ...currentProps },
      elements: {
        wrapper,
        content,
        button: downloadButton,
        container: downloadContainer,
        label: downloadLabel,
      },
    });

    const handleDownload = async (event) => {
      if (typeof onDownload !== 'function') {
        return;
      }

      const context = buildDownloadContext(event);
      downloadButton.dataset.loading = 'true';
      downloadButton.disabled = true;

      try {
        onDownloadStart?.(context);
        await Promise.resolve(onDownload(context));
        onDownloadSuccess?.(context);
      } catch (error) {
        console.error('TitleBlock download handler failed', error);
        onDownloadError?.(error, context);
      } finally {
        delete downloadButton.dataset.loading;
        if (computeShouldShowDownload()) {
          downloadButton.disabled = false;
        } else {
          downloadButton.disabled = true;
        }
        onDownloadFinally?.(context);
        refreshDownloadState();
      }
    };

    downloadButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!computeShouldShowDownload()) {
        return;
      }
      handleDownload(event);
    });

    refreshDownloadState();

    wrapper.appendChild(content);
    wrapper.appendChild(downloadContainer);

    return {
      dom: wrapper,
      contentDOM: content,
      update(updatedBlock) {
        if (updatedBlock.type.name !== 'title') {
          return false;
        }
        // console.log("updateBlock", updatedBlock);
        currentBlock = updatedBlock;
        currentProps = { ...updatedBlock.props };
        updatePlaceholder();
        refreshDownloadState();
        return true;
      },
    };
  },
  toExternalHTML(block) {
    const titleText = (block?.content ?? [])
      .map((node) => {
        if (node.type === 'text') {
          return node.text || '';
        }
        if (node.type === 'paragraph') {
          return (node.content ?? [])
            .map((child) => (child.type === 'text' ? child.text || '' : ''))
            .join('');
        }
        return '';
      })
      .join('')
      .trim();

    if (typeof document === 'undefined') {
      return {
        dom: {
          nodeName: 'H1',
          textContent: titleText,
        },
      };
    }

    const heading = document.createElement('h1');
    heading.className = 'bn-title-block-external';
    heading.textContent = titleText || DEFAULT_PLACEHOLDER;
    return { dom: heading };
  },
}));

export { TitleBlock };
export default TitleBlock;
