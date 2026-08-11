import React from 'react';
import {
  FileOutlined,
  AppstoreOutlined,
  FormOutlined,
  FolderOutlined,
  FolderFilled,
  FolderOpenFilled,
  ReadOutlined,
  FilePdfOutlined,
  PlaySquareOutlined,
  CustomerServiceOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  BookOutlined,
} from '@ant-design/icons';

/**
 * Centrally managed resource icons for the entire application.
 * Ensures consistency between the sidebar tree and folder panels.
 */
export const getResourceIcon = (type, options = {}) => {
  const { 
    isExpanded = false, 
    isContainer = false, 
    large = false,
    color = null,
    isSkill = false,
    isKnowledge = false,
  } = options;

  const baseStyle = { 
    fontSize: large ? '24px' : '16px', 
    color: color || '#91918e' 
  };
  
  const folderColor = '#faad14';
  const pdfColor = '#ff4d4f';
  const videoColor = '#fa8c16';
  const skillColor = '#722ed1'; // Premium purple for skills
  const knowledgeColor = '#13c2c2'; // Premium teal for knowledge

  switch (type) {
    case 'folder':
      return isExpanded 
        ? <FolderOpenFilled style={{ ...baseStyle, color: folderColor }} /> 
        : <FolderFilled style={{ ...baseStyle, color: folderColor }} />;
    
    case 'form':
      return <FormOutlined style={baseStyle} />;
    
    case 'view':
      return <AppstoreOutlined style={baseStyle} />;
    
    case 'document':
      if (isSkill) {
        return <ThunderboltOutlined style={{ ...baseStyle, color: color || skillColor }} />;
      }
      if (isKnowledge) {
        return <BookOutlined style={{ ...baseStyle, color: color || knowledgeColor }} />;
      }
      if (isContainer) {
        return isExpanded 
          ? <ReadOutlined style={baseStyle} /> 
          : <FolderOutlined style={baseStyle} />;
      }
      return <FileTextOutlined style={baseStyle} />;
    
    case 'pdf':
      return <FilePdfOutlined style={{ ...baseStyle, color: pdfColor }} />;
    
    case 'video':
    case 'mp4':
      return <PlaySquareOutlined style={{ ...baseStyle, color: videoColor }} />;
    
    case 'audio':
    case 'mp3':
      return <CustomerServiceOutlined style={{ ...baseStyle, color: color || '#1890ff' }} />;
    
    default:
      return <FileOutlined style={baseStyle} />;
  }
};
