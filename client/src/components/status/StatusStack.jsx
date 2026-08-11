import React, { useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import './StatusStack.css';

function StatusStack({ items = [], size = 36, overlap = 12, onItemHover }) {
  const prevIdsRef = useRef(new Set());
  const containerStyle = useMemo(
    () => ({
      '--status-stack-hover-gap': `${Math.abs(overlap)}px`,
    }),
    [overlap],
  );

  const enteringIds = useMemo(() => {
    const prev = prevIdsRef.current;
    const entering = new Set();
    items.forEach((item) => {
      if (!prev.has(item.id)) {
        entering.add(item.id);
      }
    });
    return entering;
  }, [items]);

  useEffect(() => {
    prevIdsRef.current = new Set(items.map((item) => item.id));
  }, [items]);

  return (
    <div className="status-stack" role="list" style={containerStyle}>
      {items.map((item, index) => {
        const classNames = [
          'status-stack-item',
          enteringIds.has(item.id) ? 'status-stack-item--enter' : '',
          item.status ? `status-stack-item--${item.status}` : '',
        ]
          .filter(Boolean)
          .join(' ');
        const style = {
          '--status-stack-size': `${size}px`,
          '--status-stack-order': index + 1,
          '--status-stack-offset': index === 0 ? '0px' : `-${Math.abs(overlap)}px`,
        };
        const bubbleStyle = {
          background: item.color || '#6366f1',
          color: item.textColor || '#ffffff',
        };

        const handleMouseEnter = () => {
          if (typeof onItemHover === 'function') {
            onItemHover(item);
          }
        };

        const handleMouseLeave = () => {
          if (typeof onItemHover === 'function') {
            onItemHover(null);
          }
        };

        return (
          <div
            key={item.id}
            className={classNames}
            style={style}
            role="listitem"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            title={item.label}
          >
            <div className="status-stack-item__bubble" style={bubbleStyle}>
              {item.icon || item.label?.charAt(0)?.toUpperCase()}
            </div>
            <div className="status-stack-item__label">
              <div className="status-stack-item__label-text">{item.label}</div>
              {item.description && (
                <div className="status-stack-item__label-desc">{item.description}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

StatusStack.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
      description: PropTypes.string,
      color: PropTypes.string,
      textColor: PropTypes.string,
      icon: PropTypes.node,
      status: PropTypes.string,
    }),
  ),
  size: PropTypes.number,
  overlap: PropTypes.number,
  onItemHover: PropTypes.func,
};

export default StatusStack;
