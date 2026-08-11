import React, { useState } from 'react';
import GenericTree, { handleTreeDrop } from './GenericTree';
import { Button, Space, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';

const x = 3;
const y = 2;
const z = 1;

const generateData = (_level, _preKey, _tns) => {
  const preKey = _preKey || '0';
  const tns = _tns || [];
  const children = [];
  for (let i = 0; i < x; i++) {
    const key = `${preKey}-${i}`;
    tns.push({ title: `Node ${key}`, key });
    if (i < y) {
      children.push(key);
    }
  }
  if (_level < 0) {
    return tns;
  }
  const level = _level - 1;
  children.forEach((key, index) => {
    tns[index].children = [];
    generateData(level, key, tns[index].children);
  });
  return tns;
};

const TreeDemo = () => {
  const [gData, setGData] = useState(() => generateData(z));
  
  const handleDataChange = (newData) => {
    setGData(newData);
    console.log('Tree data changed:', newData);
  };

  const renderActions = (node) => (
    <Space size={2}>
      <Tooltip title="Add Child">
        <Button 
          type="text" 
          icon={<PlusOutlined />} 
          className="gt-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            console.log('Add child to:', node.key);
          }}
        />
      </Tooltip>
      <Tooltip title="Edit">
        <Button 
          type="text" 
          icon={<EditOutlined />} 
          className="gt-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            console.log('Edit node:', node.key);
          }}
        />
      </Tooltip>
      <Tooltip title="Delete">
        <Button 
          type="text" 
          icon={<DeleteOutlined />} 
          danger
          className="gt-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            console.log('Delete node:', node.key);
          }}
        />
      </Tooltip>
    </Space>
  );

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ background: '#fff', padding: 16, borderRadius: 8, maxWidth: 600, margin: '0 auto', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h2>Generic Tree Demo</h2>
        <p>This tree supports drag and drop, custom actions, and automatic state management.</p>
        <GenericTree
          treeData={gData}
          onDataChange={handleDataChange}
          draggable
          renderActions={renderActions}
          treeProps={{
            defaultExpandAll: true,
          }}
        />
      </div>
    </div>
  );
};

export default TreeDemo;
