import React from 'react';
import { FormOutlined } from '@ant-design/icons';
import Builder from './Builder.jsx';
import Properties from './Properties.jsx';
import Renderer from './Renderer.jsx';

const multiLineTextPlugin = {
  type: 'multi-line-text',
  label: '多行文本',
  icon: <FormOutlined />,
  group: '输入类',
  defaultValue: () => ({
    label: '多行文本',
    placeholder: '请输入文本内容...',
    rows: 4,
  }),
  builderComponent: Builder,
  propertiesComponent: Properties,
  rendererComponent: Renderer,
};

export default multiLineTextPlugin;
