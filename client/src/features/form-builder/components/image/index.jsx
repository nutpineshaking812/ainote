import { FileImageOutlined } from '@ant-design/icons';
import Builder from './Builder.jsx';
import Renderer from './Renderer.jsx';
import Properties from './Properties.jsx';

export default {
  type: 'image',
  label: '图片',
  icon: <FileImageOutlined />,
  group: '媒体与特殊输入类',
  builderComponent: Builder,
  rendererComponent: Renderer,
  propertiesComponent: Properties,
  defaultValue: () => ({
    label: '图片',
    maxCountEnabled: false,
    maxCount: 1,
    displayMode: 'card',
    autoCompressEnabled: false,
    maxFileSizeEnabled: false,
    maxFileSizeMB: 2,
  }),
};
