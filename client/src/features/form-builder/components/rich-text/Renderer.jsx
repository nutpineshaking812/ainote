import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const Renderer = ({ field, value, onChange, disabled }) => {
  const rows = field.properties?.rows || 5;
  const minHeight = rows * 24 + 42; // rough estimate: 24px per line + toolbar height

  return (
    <div className="rich-text-renderer" style={{ minHeight }}>
      <ReactQuill 
        value={value} 
        onChange={onChange} 
        readOnly={disabled}
        style={{ height: minHeight - 42 }}
      />
    </div>
  );
};

export default Renderer;
