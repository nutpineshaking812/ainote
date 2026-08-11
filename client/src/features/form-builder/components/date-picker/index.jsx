import { CalendarOutlined } from '@ant-design/icons';
import Builder from './Builder.jsx';
import Renderer from './Renderer.jsx';
import Properties from './Properties.jsx';

export default {
  type: 'date-picker',
  label: '日期选择器',
  icon: <CalendarOutlined />,
  group: '日期时间类',
  builderComponent: Builder,
  rendererComponent: Renderer,
  propertiesComponent: Properties,
  defaultValue: () => ({
    label: '日期选择器',
    placeholder: '请选择日期',
  }),
};
