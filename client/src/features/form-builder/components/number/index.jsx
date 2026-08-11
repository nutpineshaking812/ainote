import { NumberOutlined } from '@ant-design/icons';
import Builder from './Builder.jsx';
import Renderer from './Renderer.jsx';
import Properties from './Properties.jsx';

export default {
  type: 'number',
  label: '数字',
  icon: <NumberOutlined />,
  group: '输入类',
  builderComponent: Builder,
  rendererComponent: Renderer,
  propertiesComponent: Properties,
  defaultValue: () => ({
    label: '数字',
    placeholder: '请输入数字',
    min: null,
    max: null,
  }),
};
