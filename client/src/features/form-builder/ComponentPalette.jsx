import React from 'react';
import { useDrag } from 'react-dnd';
import { Typography, Row, Col } from 'antd';
import { componentCategories } from './components';

const ItemTypes = { COMPONENT: 'component', FIELD: 'field' };

const DraggableComponent = ({ plugin, handleDrop, fields, onDragBegin, onDragEnd }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.COMPONENT,
    item: () => {
      if (onDragBegin) onDragBegin();
      return { type: plugin.type };
    },
    end: () => {
      if (onDragEnd) onDragEnd();
    },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));
  const handleClick = () => {
    handleDrop(plugin.type, fields.length);
  };
  return (
    <div
      ref={drag}
      onClick={handleClick}
      style={{
        padding: '10px',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        cursor: 'move',
        opacity: isDragging ? 0.5 : 1,
        background: '#fff',
        textAlign: 'center',
      }}
    >
      {plugin.icon} {plugin.label}
    </div>
  );
};

const ComponentPalette = ({ handleDrop, fields, onDragBegin, onDragEnd }) => {
  return (
    <div style={{ padding: '24px 16px' }}>
      {Object.values(componentCategories).map((category) => (
        <div key={category.label} style={{ marginBottom: '24px' }}>
          <Typography.Title level={5} style={{ marginBottom: '16px' }}>
            {category.label}
          </Typography.Title>
          <Row gutter={[16, 16]}>
            {category.components.map((plugin) => (
              <Col span={12} key={plugin.type}>
                <DraggableComponent
                  plugin={plugin}
                  handleDrop={handleDrop}
                  fields={fields}
                  onDragBegin={onDragBegin}
                  onDragEnd={onDragEnd}
                />
              </Col>
            ))}
          </Row>
        </div>
      ))}
    </div>
  );
};

export default ComponentPalette;
