import { MinusOutlined } from '@ant-design/icons';
import Builder from './Builder.jsx';

export default {
  type: 'divider',
  label: '分割线',
  icon: <MinusOutlined />,
  group: '布局与交互类',
  recordable: false, // Marked as non-recordable layout element
  builderComponent: Builder,
  rendererComponent: Builder, // Use builder for rendering as well
  propertiesComponent: () => null, // No properties
  defaultValue: () => ({}),
};
