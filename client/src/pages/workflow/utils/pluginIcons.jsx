import React from 'react';
import * as AntIcons from '@ant-design/icons';

/**
 * 智能图标渲染器
 * 1. 如果是以 http/https 开头的字符串，渲染为 <img>
 * 2. 如果是 Ant Design 图标名，渲染为对应的 React 组件
 * 3. 支持外部传入颜色和样式
 * 
 * @param {string} iconName - 图标标识（URL 或组件名）
 * @param {Object} options - 配置项
 * @param {string} options.color - 图标颜色
 * @param {Object} options.style - 附加样式
 * @returns {ReactNode}
 */
export const getPluginIcon = (iconName, { color, ...style } = {}) => {
  if (!iconName) return <AntIcons.ApiOutlined style={{ color, ...style }} />;

  // 0. 如果已经是一个 React 元素（比如核心节点的图标），直接返回
  if (typeof iconName !== 'string') {
    return iconName;
  }

  // 1. 处理 URL 图标
  if (iconName.startsWith('http')) {
    return (
      <img 
        src={iconName} 
        alt="plugin-icon" 
        style={{ 
          width: style.fontSize || 18, 
          height: style.fontSize || 18, 
          objectFit: 'contain',
          ...style 
        }} 
      />
    );
  }

  // 2. 从 Ant Design 图标库中动态获取组件
  const IconComponent = AntIcons[iconName] || AntIcons.ApiOutlined;

  const iconProps = {
    style: {
      color: color || undefined,
      ...style,
    },
  };

  return <IconComponent {...iconProps} />;
};
