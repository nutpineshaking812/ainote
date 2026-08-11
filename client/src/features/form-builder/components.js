import singleLineTextPlugin from './components/single-line-text/index.jsx';
import multiLineTextPlugin from './components/multi-line-text/index.jsx';
import numberPlugin from './components/number/index.jsx';
import dropdownPlugin from './components/dropdown/index.jsx';
import datePickerPlugin from './components/date-picker/index.jsx';
import radioGroupPlugin from './components/radio-group/index.jsx';
import checkboxGroupPlugin from './components/checkbox-group/index.jsx';
import dropdownCheckboxPlugin from './components/dropdown-checkbox/index.jsx';
import imagePlugin from './components/image/index.jsx';
import attachmentPlugin from './components/attachment/index.jsx';
import dividerPlugin from './components/divider/index.jsx';
import buttonPlugin from './components/button/index.jsx';
import richTextPlugin from './components/rich-text/index.jsx';
import matrixScalePlugin from './components/matrix-scale/index.jsx';
import rankingPlugin from './components/ranking/index.jsx';
import ratePlugin from './components/rate/index.jsx';

export const componentCategories = {
  basicInputs: {
    label: '基础输入类',
    components: [
      singleLineTextPlugin,
      multiLineTextPlugin,
      numberPlugin,
      datePickerPlugin,
      radioGroupPlugin,
      checkboxGroupPlugin,
      dropdownPlugin,
      dropdownCheckboxPlugin,
      matrixScalePlugin,
      rankingPlugin,
      ratePlugin,
    ],
  },
  mediaAndSpecialInputs: {
    label: '媒体与特殊输入类',
    components: [imagePlugin, attachmentPlugin, richTextPlugin],
  },
  layoutAndInteraction: {
    label: '布局与交互类',
    components: [dividerPlugin, buttonPlugin],
  },
};

export const allComponents = Object.values(componentCategories).flatMap(
  (category) => category.components,
);
