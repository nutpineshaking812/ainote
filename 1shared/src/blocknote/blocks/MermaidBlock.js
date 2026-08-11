import { createBlockConfig, createBlockSpec } from '@blocknote/core';

export const DEFAULT_MERMAID_DIAGRAM = `graph TD\n  Start([Start]) --> Decision{Condition}\n  Decision -->|Yes| Action[Action]\n  Decision -->|No| Alternate[Alternate]\n  Action --> End([End])\n  Alternate --> End`;

const createMermaidBlockConfig = createBlockConfig(() => ({
  type: 'mermaid',
  content: 'none',
  propSchema: {
    diagram: { type: 'string', default: DEFAULT_MERMAID_DIAGRAM },
  },
}));

const ensureDom = () => {
  if (typeof document !== 'undefined') {
    const node = document.createElement('div');
    node.className = 'bn-mermaid-block';
    return node;
  }
  return {
    nodeName: 'DIV',
    className: 'bn-mermaid-block',
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

const createMermaidBlockImplementation = (dependencies = {}) => {
  const { React, createRoot, Mermaid } = dependencies;
  const canRender =
    typeof document !== 'undefined' &&
    typeof createRoot === 'function' &&
    typeof React?.createElement === 'function' &&
    Mermaid;

  return {
    meta: {
      selectable: false,
      isolating: true,
    },
    render(block) {
      const dom = ensureDom();
      ensureDataset(dom);

      if (!canRender) {
        dom.dataset.empty = 'true';
        return {
          dom,
          destroy() {},
          update(updatedBlock) {
            return updatedBlock.type === 'mermaid';
          },
          ignoreMutation() {
            return true;
          },
        };
      }

      let currentProps = { ...block.props };
      const root = createRoot(dom);

      const renderDiagram = (diagram) => {
        const trimmed = (diagram ?? '').trim();
        dom.dataset.empty = trimmed ? 'false' : 'true';
        const element = trimmed
          ? React.createElement(Mermaid, { className: 'bn-mermaid-block-view' }, diagram)
          : React.createElement(
              'div',
              { className: 'bn-mermaid-block-empty' },
              'Mermaid diagram is empty',
            );
        root.render(element);
      };

      renderDiagram(currentProps.diagram ?? '');

      return {
        dom,
        update(updatedBlock) {
          if (updatedBlock.type !== 'mermaid') {
            return false;
          }
          currentProps = { ...updatedBlock.props };
          renderDiagram(currentProps.diagram ?? '');
          return true;
        },
        destroy() {
          root.unmount();
        },
        ignoreMutation(mutation) {
          return dom.contains?.(mutation.target);
        },
      };
    },
    toExternalHTML(block) {
      if (typeof document === 'undefined') {
        return {
          dom: {
            nodeName: 'PRE',
            textContent: block.props.diagram ?? '',
          },
        };
      }
      const pre = document.createElement('pre');
      pre.setAttribute('data-block-type', 'mermaid');
      pre.textContent = block.props.diagram ?? '';
      return { dom: pre };
    },
  };
};

export const createMermaidBlock = (dependencies) =>
  createBlockSpec(createMermaidBlockConfig, () => createMermaidBlockImplementation(dependencies));

export const MermaidBlock = (dependencies) => createMermaidBlock(dependencies)();

export default createMermaidBlock;
