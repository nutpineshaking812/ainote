import React from 'react';
import { Flex } from 'antd';
import { CodeHighlighter, Mermaid } from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';
import CopyButton from '../CopyButton';

const CodeComponent = React.memo((props) => {
  const { className, children } = props;
  const lang = className?.match(/language-(\w+)/)?.[1] || '';
  if (typeof children !== 'string') return null;
  if (lang === 'mermaid') {
    return <Mermaid>{children}</Mermaid>;
  }

  const header = (
    <Flex
      orientation="horizontal"
      align="center"
      justify="space-between"
      style={{
        borderBottom: '0px solid #e8e8e8',
        color: 'var(--ant-color-text)',
        background: 'var(--ant-color-fill-content)',
        padding: 'var(--ant-padding-sm)',
        borderStartStartRadius: 'var(--ant-border-radius)',
        borderStartEndRadius: 'var(--ant-border-radius)',
      }}
    >
      <span>{lang}</span>
      <CopyButton content={children} lang={lang} />
    </Flex>
  );

  return (
    <CodeHighlighter lang={lang} header={header}>
      {children}
    </CodeHighlighter>
  );
});

const defaultComponents = {
  code: CodeComponent,
};

const XMarkdownDisplay = ({ components = {}, children, ...rest }) => {
  const mergedComponents = React.useMemo(() => {
    return { ...defaultComponents, ...components };
  }, [components]);

  const contentString = typeof children === 'string' ? children : String(children ?? '');

  return (
    <XMarkdown components={mergedComponents} {...rest}>
      {contentString}
    </XMarkdown>
  );
};

export default XMarkdownDisplay;
