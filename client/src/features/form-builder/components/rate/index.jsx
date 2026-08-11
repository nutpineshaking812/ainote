import { StarOutlined } from '@ant-design/icons';
import Builder from './Builder';
import Renderer from './Renderer';
import Properties from './Properties';

export default {
  type: 'rate',
  label: '评分',
  icon: <StarOutlined />,
  group: '基础输入类',
  builderComponent: Builder,
  rendererComponent: Renderer,
  propertiesComponent: Properties,
  defaultValue: () => ({
    label: '评分',
  }),
};

