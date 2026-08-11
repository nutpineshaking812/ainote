import React from 'react';
import { useDrag } from 'react-dnd';
import { Col, Space, Button, Popconfirm, Typography } from 'antd';
import { DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import { componentRegistry } from './registry';
import { getDisplayLabel, isFieldRequired } from './labelUtils';
import RequiredLabel from '../../components/RequiredLabel';

const ItemTypes = { FIELD: 'field' };

const DraggableField = React.memo(
  ({
    field,
    index,
    onSelectField,
    selectedFieldId,
    onDelete,
    onCopy,
    setDraggedFieldId,
    setPlaceholderIndex,
    placeholderIndex,
    draggedFieldId,
    draggedFieldIdRef,
    placeholderIndexRef,
    displayIndex,
    showIndex,
  }) => {
    const ref = React.useRef(null);

    const [{ isDragging }, drag] = useDrag(
      () => ({
        type: ItemTypes.FIELD,
        // react-dnd v14: item() is executed at the beginning of drag
        item: () => {
          // perform side-effects here
          // update refs synchronously so listeners/readers see the new value immediately
          if (draggedFieldIdRef) draggedFieldIdRef.current = field.id;
          if (placeholderIndexRef) placeholderIndexRef.current = index;
          // then update React state (may cause re-render)
          if (setDraggedFieldId) setDraggedFieldId(field.id);
          if (setPlaceholderIndex) setPlaceholderIndex(index);
          return { id: field.id };
        },
        collect: (monitor) => ({ isDragging: monitor.isDragging() }),
        end: () => {
          // clear refs first so synchronous readers see the cleared values
          if (draggedFieldIdRef) draggedFieldIdRef.current = null;
          if (placeholderIndexRef) placeholderIndexRef.current = -1;
          // then update React state
          if (setDraggedFieldId) setDraggedFieldId(null);
          if (setPlaceholderIndex) setPlaceholderIndex(-1);
          onSelectField(field.id);
        },
      }),
      [field, onSelectField, setDraggedFieldId, setPlaceholderIndex, index],
    );

    drag(ref);
    const plugin = componentRegistry.get(field.type);
    if (!plugin) return <p key={field.id}>Unknown component type: {field.type}</p>;

    // Prefer reading from refs for immediate, synchronous truth during drag
    const currentDraggedId = draggedFieldIdRef ? draggedFieldIdRef.current : draggedFieldId;
    const currentPlaceholderIndex = placeholderIndexRef
      ? placeholderIndexRef.current
      : placeholderIndex;
    const isOriginalDragged = currentDraggedId === field.id && currentPlaceholderIndex === index;
    // console.log('DraggableField render:', { fieldId: field.id, currentDraggedId, currentPlaceholderIndex, isOriginalDragged });

    // Prefer using the synchronous ref to decide hiding so the original
    // field can be hidden immediately on drag start (avoids monitor timing
    // issues when dragging from later -> earlier). Also keep monitor.isDragging
    // as a fallback.
    // console.log('DraggableField render:', {
    //   fieldId: field.id,
    //   currentDraggedId,
    //   isDragging,
    //   isOriginalDragged,
    // });
    const shouldHide = (currentDraggedId === field.id || isDragging) && !isOriginalDragged;
    const isSelected = selectedFieldId === field.id;
    const Builder = plugin.builderComponent;

    const handleCopy = (e) => {
      e.stopPropagation();
      onCopy(field.id);
    };

    if (isOriginalDragged) {
      return (
        <Col
          ref={ref}
          span={field.layout?.span || 24}
          id={`field-${field.id}`}
          style={{ marginBottom: 0 }}
        >
          <div
            style={{
              height: 80,
              marginBottom: '16px',
              border: '2px dashed #1890ff',
              background: '#fff',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1890ff',
              cursor: 'move',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              {plugin.icon}
              <div style={{ marginTop: 4 }}>
                <RequiredLabel
                  text={getDisplayLabel(field, plugin, showIndex, displayIndex)}
                  required={isFieldRequired(field)}
                />
              </div>
            </div>
          </div>
        </Col>
      );
    }

    return (
      <Col
        ref={ref}
        span={field.layout?.span || 24}
        id={`field-${field.id}`}
        style={{
          display: shouldHide ? 'none' : 'block',
          pointerEvents: shouldHide ? 'none' : undefined,
          marginBottom: '4px',
        }}
      >
        <div
          onClick={() => onSelectField(field.id)}
          style={{
            padding: 8,
            background: isSelected ? '#e6f7ff' : 'transparent',
            borderRadius: 8,
            position: 'relative',
            cursor: 'move',
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <Typography.Text>
              <RequiredLabel
                text={getDisplayLabel(field, plugin, showIndex, displayIndex)}
                required={isFieldRequired(field)}
              />
            </Typography.Text>
          </div>
          <div>
            <Builder field={field} />
          </div>
          {isSelected && (
            <Space style={{ position: 'absolute', top: 8, right: 16 }}>
              <Button shape="circle" icon={<CopyOutlined />} size="small" onClick={handleCopy} />
              <Popconfirm
                title="确认删除"
                description="您确定要删除此组件吗？"
                onConfirm={() => onDelete(field.id)}
                okText="删除"
                cancelText="取消"
                placement="topRight"
              >
                <Button
                  shape="circle"
                  icon={<DeleteOutlined />}
                  size="small"
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            </Space>
          )}
        </div>
      </Col>
    );
  },
);

export default DraggableField;
