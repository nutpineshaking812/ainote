import React from 'react';
import { EditOutlined } from '@ant-design/icons';
import Builder from './Builder.jsx';
import Properties from './Properties.jsx';
import Renderer from './Renderer.jsx';

const singleLineTextPlugin = {
  type: 'single-line-text',
  label: '单行文本',
  icon: <EditOutlined />,
  group: '输入类',
  defaultValue: () => ({
    label: '单行文本',
    placeholder: '请输入内容...',
  }),
  builderComponent: Builder,
  propertiesComponent: Properties,
  rendererComponent: Renderer,
};

export default singleLineTextPlugin;
