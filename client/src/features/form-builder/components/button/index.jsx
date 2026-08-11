import { PushpinOutlined } from '@ant-design/icons';
import Builder from './Builder.jsx';
import Properties from './Properties.jsx';

export default {
  type: 'button',
  label: '按钮',
  icon: <PushpinOutlined />,
  group: '布局与交互类',
  recordable: false, // Marked as non-recordable layout element
  builderComponent: Builder,
  rendererComponent: Builder, // Use builder for rendering as well
  propertiesComponent: Properties,
  defaultValue: () => ({
    label: '按钮',
    buttonType: 'default',
  }),
};
