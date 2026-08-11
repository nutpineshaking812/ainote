import { CheckSquareOutlined } from '@ant-design/icons';
import Builder from './Builder.jsx';
import Renderer from './Renderer.jsx';
import Properties from './Properties.jsx';

export default {
  type: 'checkbox-group',
  label: '复选框组',
  icon: <CheckSquareOutlined />,
  group: '选择类',
  builderComponent: Builder,
  rendererComponent: Renderer,
  propertiesComponent: Properties,
  defaultValue: () => ({
    label: '复选框组',
    direction: 'vertical',
    options: [
      { label: '选项一', value: 'option1' },
      { label: '选项二', value: 'option2' },
    ],
  }),
};
