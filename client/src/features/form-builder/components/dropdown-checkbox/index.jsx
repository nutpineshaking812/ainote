import { DownOutlined } from '@ant-design/icons';
import Builder from './Builder.jsx';
import Renderer from './Renderer.jsx';
import Properties from './Properties.jsx';

export default {
  type: 'dropdown-checkbox',
  label: '下拉复选框',
  icon: <DownOutlined />,
  group: '选择类',
  builderComponent: Builder,
  rendererComponent: Renderer,
  propertiesComponent: Properties,
  defaultValue: () => ({
    label: '下拉复选框',
    placeholder: '请选择',
    options: [
      { label: '选项一', value: 'option1' },
      { label: '选项二', value: 'option2' },
    ],
    optionsSource: { mode: 'static' },
    value: [],
  }),
};
