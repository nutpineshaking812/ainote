import { TableOutlined } from '@ant-design/icons';
import Builder from './Builder.jsx';
import Renderer from './Renderer.jsx';
import Properties from './Properties.jsx';

export default {
  type: 'matrix-scale',
  label: '矩阵量表',
  icon: <TableOutlined />,
  group: '选择类',
  builderComponent: Builder,
  rendererComponent: Renderer,
  propertiesComponent: Properties,
  defaultValue: () => ({
    label: '矩阵量表',
    rows: [
      { label: '行一', value: 'row1' },
      { label: '行二', value: 'row2' },
    ],
    columns: [
      { label: '列一', value: 'col1' },
      { label: '列二', value: 'col2' },
    ],
  }),
};
