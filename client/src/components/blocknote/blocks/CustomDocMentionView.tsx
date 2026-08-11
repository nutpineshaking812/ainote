import React from 'react';
import { 
  FileTextOutlined, 
  FormOutlined, 
  TableOutlined, 
  ToolOutlined,
  ApiOutlined
} from '@ant-design/icons';
import useAppStore from '../../../store/useAppStore';

export interface CustomDocMentionViewProps {
  inlineContent: any;
  editor: any;
}

const getTypeConfig = (type: string) => {
  switch (type) {
    case 'form':
      return {
        icon: <FormOutlined style={{ marginRight: 4, color: '#fa8c16' }} />,
        bg: '#fff7e6',
        border: '1px solid #ffd591',
        color: '#d46b08',
      };
    case 'view':
      return {
        icon: <TableOutlined style={{ marginRight: 4, color: '#722ed1' }} />,
        bg: '#f9f0ff',
        border: '1px solid #d3adf7',
        color: '#531dab',
      };
    case 'tool':
      return {
        icon: <ToolOutlined style={{ marginRight: 4, color: '#ff4d4f' }} />,
        bg: '#fff1f0',
        border: '1px solid #ffa39e',
        color: '#cf1322',
      };
    case 'mcp':
      return {
        icon: <ApiOutlined style={{ marginRight: 4, color: '#13c2c2' }} />,
        bg: '#e6fffb',
        border: '1px solid #87e8de',
        color: '#08979c',
      };
    case 'document':
    default:
      return {
        icon: <FileTextOutlined style={{ marginRight: 4, color: '#1890ff' }} />,
        bg: '#e6f7ff',
        border: '1px solid #91d5ff',
        color: '#1890ff',
      };
  }
};

export function CustomDocMentionView({ inlineContent, editor }: CustomDocMentionViewProps) {
  const { docId, title, type = 'document' } = inlineContent.props;

  const resourcesList = useAppStore((state: any) => state.appResources) || [];
  const matchingResource = resourcesList.find(
    (r: any) => r.type === type && (r.refId === docId || r.id === docId),
  );
  const displayTitle = matchingResource?.meta?.name || title || '未命名文件';
  const config = getTypeConfig(type);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!docId) return;

    if (type === 'tool' || type === 'mcp') return;

    const targetUrl = `#/${type}/${docId}`;
    if (typeof window !== 'undefined') {
      window.location.hash = targetUrl;
    }
  };

  return (
    <span
      className={`bn-custom-doc-mention type-${type}`}
      onClick={handleClick}
      contentEditable={false}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: config.bg,
        border: config.border,
        borderRadius: 4,
        padding: '1px 6px',
        margin: '0 2px',
        color: config.color,
        fontWeight: 500,
        fontSize: '14px',
        cursor: (type === 'tool' || type === 'mcp') ? 'default' : 'pointer',
        userSelect: 'none',
        transition: 'all 0.2s ease',
        verticalAlign: 'middle',
      }}
    >
      {config.icon}
      {displayTitle}
    </span>
  );
}

export default CustomDocMentionView;
