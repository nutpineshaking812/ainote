import { PaperClipOutlined } from '@ant-design/icons';
import Builder from './Builder.jsx';
import Renderer from './Renderer.jsx';
import Properties from './Properties.jsx';

export default {
  type: 'attachment',
  label: '附件',
  icon: <PaperClipOutlined />,
  group: '媒体与特殊输入类',
  builderComponent: Builder,
  rendererComponent: Renderer,
  propertiesComponent: Properties,
  defaultValue: () => ({
    label: '附件',
    // defaults for new attachment fields
    maxCountEnabled: false,
    maxCount: 3,
    maxFileSizeEnabled: false,
    maxFileSizeMB: 20,
    allowedTypes: [],
  }),
};
