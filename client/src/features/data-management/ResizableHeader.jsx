import React, { useCallback } from 'react';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';

// A reusable resizable table header cell component.
// Props:
// - appId, formId: used for width persistence key
// - columns: original editable/data columns array
// - columnWidths: current widths map {dataIndex: width}
// - setColumnWidths: state setter to update widths
// Returns: { mergedColumns, HeaderCell } where HeaderCell is supplied to antd Table components.header.cell
export const useResizableColumns = ({ appId, formId, columns, columnWidths, setColumnWidths }) => {
  // factory for resize handler with debounce + persistence
  const handleResizeFactory = useCallback(
    (dataIndex) => {
      let debounceTimer;
      return (_e, { size }) => {
        setColumnWidths((prev) => {
          const clamped = Math.min(600, Math.max(60, Math.round(size.width)));
          const next = { ...prev, [dataIndex]: clamped };
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            try {
              localStorage.setItem(`dmw_widths_${appId}_${formId}`, JSON.stringify(next));
            } catch {
              /* ignore */
            }
          }, 250);
          return next;
        });
      };
    },
    [appId, formId, setColumnWidths],
  );

  const HeaderCell = React.useMemo(
    () =>
      function ResizableHeaderCell({ onResize, width, children, style, ...rest }) {
        // Ensure consistent width handling between header and body: apply width on th, not only inner div
        // console.log('ResizableHeaderCell render for', style);
        const baseStyle = {
          // position: 'relative',
          padding: 0,
          boxSizing: 'border-box',
          overflow: 'hidden',
          ...(width ? { width, minWidth: width, maxWidth: width } : {}),
          ...style,
        };
        const innerStyle = {
          padding: '8px 8px',
          lineHeight: '20px',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
        };
        // if (!width) {
        //   return (
        //     <th {...rest} style={baseStyle}>
        //       <div style={innerStyle}>{children}</div>
        //     </th>
        //   );
        // }
        if (!width) {
          return (
            <th {...rest} style={baseStyle}>
              <div style={innerStyle}>{children}</div>
            </th>
          );
        }

        return (
          <Resizable
            width={width}
            height={0}
            handle={
              <span
                className="resizable-handle"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: 6,
                  cursor: 'col-resize',
                }}
              />
            }
            onResize={onResize}
            draggableOpts={{ enableUserSelectHack: false }}
            {...rest}
          >
            <th {...rest} style={baseStyle}>
              <div style={innerStyle}>{children}</div>
            </th>
          </Resizable>
        );
      },
    [],
  );

  // attach header resize handlers
  const mergedColumns = React.useMemo(
    () =>
      columns.map((col) => {
        const isResizable = col.dataIndex !== 'operation';
        return {
          ...col,
          onHeaderCell: (c) => ({
            width: c.width,
            onResize: isResizable ? handleResizeFactory(c.dataIndex) : undefined,
          }),
        };
      }),
    [columns, handleResizeFactory],
  );

  return { mergedColumns, HeaderCell };
};
