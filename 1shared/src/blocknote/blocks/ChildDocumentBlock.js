import { createBlockConfig, createBlockSpec } from '@blocknote/core';
const DEFAULT_TITLE = '未命名文件';

const createChildDocumentBlockConfig = createBlockConfig(() => ({
  type: 'childDocument',
  content: 'none',
  propSchema: {
    id: { type: 'string', default: 'child-doc-block' },
    title: { type: 'string', default: DEFAULT_TITLE },
    docId: { type: 'string', default: '' },
    type: { type: 'string', default: 'document' },
    icon: { type: 'string', default: '' },
    url: { type: 'string', default: '' },
  },
}));

const createFileIcon = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 1024 1024');
  svg.setAttribute('width', '1em');
  svg.setAttribute('height', '1em');
  svg.setAttribute('fill', 'currentColor');

  svg.style.color = '#8c8c8c';

  const body = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  body.setAttribute(
    'd',
    'M854.6 288.6L639.4 73.4c-6-6-14.1-9.4-22.6-9.4H192c-17.7 0-32 14.3-32 32v832c0 17.7 14.3 32 32 32h640c17.7 0 32-14.3 32-32V311.3c0-8.5-3.4-16.7-9.4-22.7zM790.2 326H602V137.8L790.2 326zm1.8 562H232V136h302v216a42 42 0 0042 42h216v494z',
  );

  svg.appendChild(body);
  return svg;
};

const ChildDocumentBlock = createBlockSpec(createChildDocumentBlockConfig, () => ({
  render(block) {
    let currentProps = { ...block.props };

    const root = document.createElement('div');
    root.className = 'bn-child-doc-block';
    root.setAttribute('contenteditable', 'false');
    root.setAttribute('role', 'button');

    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'bn-child-doc-icon';

    const infoWrapper = document.createElement('div');
    infoWrapper.className = 'bn-child-doc-info';

    const titleNode = document.createElement('div');
    titleNode.className = 'bn-child-doc-title';
    infoWrapper.appendChild(titleNode);

    const applyIcon = () => {
      iconWrapper.replaceChildren();

      const iconValue = currentProps.icon;
      if (iconValue) {
        if (typeof iconValue === 'string' && iconValue.trim().startsWith('<')) {
          iconWrapper.innerHTML = iconValue;
        } else {
          iconWrapper.textContent = String(iconValue);
        }
        return;
      }

      iconWrapper.appendChild(createFileIcon());
    };

    const applyTitle = () => {
      titleNode.textContent = currentProps.title || DEFAULT_TITLE;
    };

    const applyAccessibility = () => {
      const clickable = Boolean(currentProps.docId || currentProps.url);
      root.tabIndex = clickable ? 0 : -1;
      root.setAttribute('aria-disabled', clickable ? 'false' : 'true');
      root.style.cursor = clickable ? 'pointer' : 'default';
    };

    const navigateToTarget = () => {
      const targetUrl = currentProps.url || `#/${currentProps.type}/${currentProps.docId}`;
      if (!targetUrl || typeof window === 'undefined') {
        return;
      }

      if (/^https?:/i.test(targetUrl)) {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      if (targetUrl.startsWith('#')) {
        window.location.hash = targetUrl;
      } else {
        window.location.hash = `#${targetUrl}`;
      }
    };

    const handleActivate = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!currentProps.docId && !currentProps.url) {
        return;
      }
      navigateToTarget();
    };

    root.addEventListener('click', handleActivate);
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        handleActivate(event);
      }
    });

    applyIcon();
    applyTitle();
    applyAccessibility();

    root.appendChild(iconWrapper);
    root.appendChild(infoWrapper);

    return {
      dom: root,
      update(updatedBlock) {
        if (updatedBlock.type !== 'childDocument') {
          return false;
        }

        currentProps = { ...updatedBlock.props };
        applyIcon();
        applyTitle();
        applyAccessibility();

        return true;
      },
    };
  },
  toExternalHTML(block) {
    const { docId, title, icon, url, type } = block.props;
    // console.log('toExternalHTML', block.props);
    const anchor = document.createElement('a');
    const href = url || `app#/${type}/${docId}`;
    anchor.href = href;
    anchor.className = 'bn-child-doc-block-external';
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';

    const iconContainer = document.createElement('span');
    iconContainer.className = 'bn-child-doc-icon';
    if (icon) {
      iconContainer.appendChild(document.createTextNode(icon));
    } else {
      iconContainer.appendChild(createFileIcon());
    }

    const titleContainer = document.createElement('span');
    titleContainer.className = 'bn-child-doc-title';
    titleContainer.textContent = title || DEFAULT_TITLE;

    anchor.appendChild(iconContainer);
    anchor.appendChild(titleContainer);

    return { dom: anchor };
  },
}));

export { ChildDocumentBlock };
export default ChildDocumentBlock;