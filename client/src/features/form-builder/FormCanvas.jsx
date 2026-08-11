import React from 'react';
import { useDrop } from 'react-dnd';
import { Row, Col } from 'antd';
import DraggableField from './DraggableField';
import { componentRegistry } from './registry';
import { groupFieldsIntoRows } from './layoutUtils';

const ItemTypes = { COMPONENT: 'component', FIELD: 'field' };

const FormCanvas = ({
  fields,
  onDrop,
  onSelectField,
  selectedFieldId,
  onDelete,
  onCopy,
  updateFields,
  form,
}) => {
  const canvasRef = React.useRef(null);
  const placeholderIndexRef = React.useRef(-1);
  const draggedFieldIdRef = React.useRef(null);
  const forceRender = React.useReducer((x) => x + 1, 0)[1];

  const setPlaceholderIndex = React.useCallback(
    (idx) => {
      if (placeholderIndexRef.current !== idx) {
        placeholderIndexRef.current = idx;
        forceRender();
      }
    },
    [forceRender],
  );
  const setDraggedFieldId = React.useCallback(
    (id) => {
      if (draggedFieldIdRef.current !== id) {
        draggedFieldIdRef.current = id;
        forceRender();
      }
    },
    [forceRender],
  );

  const placeholderIndex = placeholderIndexRef.current;
  const draggedFieldId = draggedFieldIdRef.current;
  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: [ItemTypes.COMPONENT, ItemTypes.FIELD],
      hover: (item, monitor) => {
        if (!canvasRef.current) {
          return;
        }
        if (monitor.isOver({ shallow: true })) {
          const clientOffset = monitor.getClientOffset();
          if (!clientOffset) return;
          const canvasRect = canvasRef.current.getBoundingClientRect();
          const mouseY = clientOffset.y;
          // Measure against the full fields array (we hide the dragged element
          // via CSS rather than removing it from the DOM). This yields full-array
          // indices for placeholderIndex so DraggableField's drag-start which sets
          // the placeholder to the original full-index remains consistent.
          // When dragging an existing field, compute against the DOM of the
          // fields excluding the dragged field so measurements reflect the
          // post-removal layout. Then map that filtered index back to the full
          // array index so downstream code (which expects full-array indices)
          // works correctly.
          const itemType = monitor.getItemType();
          let measuredFields = fields;
          let skippedId = null;
          if (itemType === ItemTypes.FIELD && draggedFieldId) {
            skippedId = draggedFieldId;
            measuredFields = fields.filter((f) => f.id !== draggedFieldId);
          }

          // Default filtered index (append)
          let filteredIndex = measuredFields.length;
          if (measuredFields.length === 0) {
            filteredIndex = 0;
          } else {
            for (let i = 0; i < measuredFields.length; i++) {
              const fieldElement = document.getElementById(`field-${measuredFields[i].id}`);
              if (!fieldElement) continue;
              const fieldRect = fieldElement.getBoundingClientRect();
              const midpoint = fieldRect.top + fieldRect.height / 2;
              if (mouseY < midpoint) {
                filteredIndex = i;
                break;
              }
            }
          }

          // Map filteredIndex back to full-array index
          let newPlaceholderIndex = fields.length; // default append
          if (filteredIndex === 0) {
            // insert at beginning: full index is 0 unless first field is the dragged one
            let idx = 0;
            while (idx < fields.length && fields[idx].id === skippedId) idx++;
            newPlaceholderIndex = idx;
          } else if (filteredIndex >= measuredFields.length) {
            // append to end: full index is fields.length (inserting after last)
            newPlaceholderIndex = fields.length;
          } else {
            // Find the position of the filteredIndex-th non-skipped field in the full array
            let count = 0;
            for (let i = 0; i < fields.length; i++) {
              if (fields[i].id === skippedId) continue;
              if (count === filteredIndex) {
                newPlaceholderIndex = i;
                break;
              }
              count++;
            }
          }

          if (placeholderIndex !== newPlaceholderIndex) {
            setPlaceholderIndex(newPlaceholderIndex);
          }
        } else {
          setPlaceholderIndex(-1);
        }
      },
      drop: (item, monitor) => {
        const idx = placeholderIndexRef.current;
        if (idx !== -1) {
          const itemType = monitor.getItemType();
          if (itemType === ItemTypes.COMPONENT) {
            onDrop(item.type, idx);
          } else if (itemType === ItemTypes.FIELD) {
            updateFields((prev) => {
              const dragged = prev.find((f) => f.id === item.id);
              if (!dragged) return prev;
              const without = prev.filter((f) => f.id !== item.id);
              const clamped = Math.max(0, Math.min(idx, without.length));
              without.splice(clamped, 0, dragged);
              return without;
            });
          }
        }
        setPlaceholderIndex(-1);
        setDraggedFieldId(null);
      },
      collect: (monitor) => {
        // console.log('FormCanvas collect:', {
        //   item: monitor.getItem(),
        //   isOver: monitor.isOver({ shallow: true }),
        //   canDrop: monitor.canDrop(),
        // });
        return {
          isOver: monitor.isOver({ shallow: true }),
          canDrop: monitor.canDrop(),
        };
      },
    }),
    [fields, setPlaceholderIndex, onDrop, draggedFieldId, updateFields],
  );
  // }), []);

  // Use full fields array when grouping rows. placeholderIndex is expressed
  // relative to the full fields array (DraggableField sets placeholderIndex to
  // its original full-array index on drag start), so grouping must use full
  // fields to show the placeholder at that position.
  const rows = groupFieldsIntoRows(fields, placeholderIndex, draggedFieldId);
  const visibleFields = fields.filter((f) => f.type !== 'placeholder');

  // React.useEffect(() => {
  //   if (!isOver && placeholderIndex !== -1 && !draggedFieldId) {
  //     setPlaceholderIndex(-1);
  //   }
  //   // setPlaceholderIndex(0);
  // }, [isOver, placeholderIndex, draggedFieldId]);

  const handleCanvasClick = (e) => {
    if (e.target === e.currentTarget) {
      onSelectField(null);
    }
  };

  return (
    <div
      ref={drop(canvasRef)}
      onClick={handleCanvasClick}
      style={{
        padding: '24px',
        height: '100%',
        background: isOver ? '#e6f7ff' : '#ffffff',
        cursor: 'default',
        overflowY: 'auto',
      }}
    >
      {fields.length === 0 && <p>从左侧拖拽组件到此处来构建你的表单</p>}
      <div>
        {rows.map((row, rowIndex) => (
          <Row key={rowIndex} gutter={8}>
            {row.map((field, colIndex) => {
              if (field.type === 'placeholder') {
                // placeholder object is always present in the node tree; only
                // render it visually when it's active.
                const originalField = draggedFieldId
                  ? fields.find((f) => f.id === draggedFieldId)
                  : null;
                const placeholderSpan = originalField
                  ? originalField.layout?.span || field.layout?.span || 24
                  : field.layout?.span || 24;
                const plugin = originalField ? componentRegistry.get(originalField.type) : null;
                const labelText = originalField
                  ? originalField.properties?.label || (plugin ? plugin.label : '字段')
                  : '拖拽到此处';
                const isActive = field.active === true;
                return (
                  <Col span={placeholderSpan} key={`placeholder-${rowIndex}-${colIndex}`}>
                    <div
                      style={{
                        height: '80px',
                        border: isActive ? '2px dashed #1890ff' : '2px dashed transparent',
                        backgroundColor: isActive
                          ? originalField
                            ? '#fff'
                            : '#e6f7ff'
                          : 'transparent',
                        borderRadius: '4px',
                        marginBottom: isActive ? '16px' : 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#1890ff',
                        visibility: isActive ? 'visible' : 'hidden',
                      }}
                    >
                      <div style={{ textAlign: 'center' }}>
                        {isActive && originalField && plugin && plugin.icon}
                        <div>{isActive ? labelText : ''}</div>
                      </div>
                    </div>
                  </Col>
                );
              }
              // field here comes from the reduced `fieldsForRows` list. We need
              // to pass the original index in the full `fields` array to
              // DraggableField so that drag-start can set placeholderIndex to the
              // correct original position.
              const fieldIndex = fields.findIndex((f) => f.id === field.id);
              const displayIndex = visibleFields.findIndex((f) => f.id === field.id) + 1;
              const moveField = (from, to) => {
                updateFields((prev) => {
                  const arr = [...prev];
                  const [item] = arr.splice(from, 1);
                  arr.splice(to, 0, item);
                  return arr;
                });
              };
              return (
                <DraggableField
                  key={field.id}
                  index={fieldIndex}
                  field={field}
                  displayIndex={displayIndex}
                  showIndex={form?.showIndex}
                  onSelectField={onSelectField}
                  selectedFieldId={selectedFieldId}
                  onDelete={onDelete}
                  onCopy={onCopy}
                  moveField={moveField}
                  setDraggedFieldId={setDraggedFieldId}
                  setPlaceholderIndex={setPlaceholderIndex}
                  placeholderIndex={placeholderIndex}
                  draggedFieldId={draggedFieldId}
                  draggedFieldIdRef={draggedFieldIdRef}
                  placeholderIndexRef={placeholderIndexRef}
                />
              );
            })}
          </Row>
        ))}
      </div>
    </div>
  );
};

export default FormCanvas;
