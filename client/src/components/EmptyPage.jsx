import React from 'react';
import { Empty, Button } from 'antd';

/**
 * 通用空页面/空状态组件
 *
 * @param {string} description - 提示文字
 * @param {React.ReactNode} icon - 自定义图标
 * @param {React.ReactNode} extra - 额外操作区域（通常是按钮）
 * @param {string} height - 容器高度，默认 100%
 * @param {object} imageStyle - 图片样式
 * @param {string} children - 嵌套内容
 */
const EmptyPage = ({
  description,
  image,
  extra,
  height = '100%',
  padding = '100px 0',
  imageStyle,
  children,
  ...props
}) => {
  return (
    <div
      style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding,
        width: '100%',
        flexDirection: 'column',
      }}
      className="empty-page-container"
    >
      <Empty
        image={image || Empty.PRESENTED_IMAGE_SIMPLE}
        description={description || <span style={{ color: '#94a3b8' }}>暂无数据</span>}
        imageStyle={{
          height: 60,
          marginBottom: 16,
          ...imageStyle,
        }}
        {...props}
      >
        {extra && <div style={{ marginTop: 16 }}>{extra}</div>}
        {children}
      </Empty>
    </div>
  );
};

export default EmptyPage;
