import React, { useState, useEffect } from 'react';
import { Drawer } from 'antd';

/**
 * ResizableDrawer - 一个支持拖拽缩放的通用 Drawer 组件
 * 基于 Ant Design 的 resizable 属性封装
 *
 * Props:
 * - defaultWidth/defaultHeight: 初始尺寸 (默认 600)
 * - minWidth/maxWidth: 水平缩放限制
 * - minHeight/maxHeight: 垂直缩放限制
 * - open, onClose, children ...: 继承自 antd Drawer
 */
const resolveDimension = (val, total) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    if (val.endsWith('vw')) return (parseFloat(val) / 100) * window.innerWidth;
    if (val.endsWith('vh')) return (parseFloat(val) / 100) * window.innerHeight;
    if (val.endsWith('%')) return (parseFloat(val) / 100) * total;
    return parseFloat(val);
  }
  return val;
};

const ResizableDrawer = ({
  open,
  onClose,
  children,
  defaultWidth = 600,
  defaultHeight = 400,
  minWidth = 300,
  maxWidth = '90vw',
  minHeight = 200,
  maxHeight = '90vh',
  placement = 'right',
  resizable = true,
  ...props
}) => {
  const [size, setSize] = useState(
    placement === 'top' || placement === 'bottom' ? defaultHeight : defaultWidth,
  );

  useEffect(() => {
    if (!open) {
      setSize(placement === 'top' || placement === 'bottom' ? defaultHeight : defaultWidth);
    }
  }, [defaultWidth, defaultHeight, placement, open]);

  const isVertical = placement === 'top' || placement === 'bottom';

  const resizableConfig = resizable
    ? {
        onResize: (info) => {
          let value = typeof info === 'number' ? info : isVertical ? info.height : info.width;

          // 手动执行约束逻辑，因为 Drawer 的 resizableConfig 仅透传原生 Resize 事件
          if (isVertical) {
            const minH = resolveDimension(minHeight, window.innerHeight);
            const maxH = resolveDimension(maxHeight, window.innerHeight);
            value = Math.max(minH, Math.min(value, maxH));
          } else {
            const minW = resolveDimension(minWidth, window.innerWidth);
            const maxW = resolveDimension(maxWidth, window.innerWidth);
            value = Math.max(minW, Math.min(value, maxW));
          }

          setSize(value);
        },
        ...(typeof resizable === 'object' ? resizable : {}),
      }
    : false;

  const dynamicProps = isVertical ? { size: size } : { size: size };

  return (
    <Drawer
      {...props}
      {...dynamicProps}
      open={open}
      onClose={onClose}
      placement={placement}
      resizable={resizableConfig}
    >
      {children}
    </Drawer>
  );
};

export default ResizableDrawer;
