import { FontSizeOutlined } from '@ant-design/icons';
import Builder from './Builder.jsx';
import Renderer from './Renderer.jsx';
import Properties from './Properties.jsx';

export default {
  type: 'rich-text',
  label: '富文本',
  icon: <FontSizeOutlined />,
  group: '媒体与特殊输入类',
  builderComponent: Builder,
  rendererComponent: Renderer,
  propertiesComponent: Properties,
  defaultValue: () => ({
    label: '富文本',
    value: '',
  }),
};
