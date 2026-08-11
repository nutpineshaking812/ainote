import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { MAX_BUILDER_WIDTH } from '../../constants.js';

const Builder = ({ field }) => {
  const rows = field.properties?.rows || 5;
  const minHeight = rows * 24 + 42;

  return (
    <div style={{ maxWidth: `${MAX_BUILDER_WIDTH}px`, minHeight }}>
      <ReactQuill 
        value={field.properties.value} 
        readOnly={true} 
        style={{ height: minHeight - 42 }}
      />
    </div>
  );
};

export default Builder;
