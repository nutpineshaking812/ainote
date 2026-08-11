# BlockNote Editor 模块

基于 BlockNote 的自定义富文本编辑器组件，支持内置标题块和 Markdown 双向转换。

## 📁 文件结构

```
components/blocknote/
├── index.js                    # 模块导出
├── BlockNoteEditor.jsx         # 主编辑器组件
├── schema.js                   # 自定义 Schema 定义
├── blocks/
│   └── TitleBlock.js          # 自定义标题块
├── utils/
│   └── Transport.js           # 编辑器数据传输工具
└── styles/
    └── editor.css             # 编辑器样式
```

## 🚀 快速开始

### 基础用法

```jsx
import { BlockNoteEditor } from '@/components/blocknote';

function MyComponent() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  return (
    <BlockNoteEditor
      title={title}
      value={content}
      onTitleChange={setTitle}
      onChange={setContent}
      height={500}
    />
  );
}
```

### 高级用法

```jsx
import { BlockNoteEditor } from '@/components/blocknote';

function AdvancedEditor() {
  return (
    <BlockNoteEditor
      title="我的文档"
      value="# 标题\n\n这是正文内容..."
      onTitleChange={(newTitle) => console.log('标题:', newTitle)}
      onChange={(markdown) => console.log('内容:', markdown)}
      height="calc(100vh - 200px)" // 支持 CSS 值
      readOnly={false}
      placeholder="开始书写..."
    />
  );
}
```

## 📖 API 文档

### BlockNoteEditor Props

| 属性            | 类型                         | 默认值                  | 说明                           |
| --------------- | ---------------------------- | ----------------------- | ------------------------------ |
| `title`         | `string`                     | `''`                    | 文档标题                       |
| `value`         | `string \| Array`            | `''`                    | 正文内容（Markdown 或 blocks） |
| `onTitleChange` | `(title: string) => void`    | -                       | 标题变化回调                   |
| `onChange`      | `(markdown: string) => void` | -                       | 内容变化回调                   |
| `height`        | `number \| string`           | `500`                   | 编辑器高度（px 或 CSS 值）     |
| `readOnly`      | `boolean`                    | `false`                 | 是否只读                       |
| `placeholder`   | `string`                     | `'开始书写你的想法...'` | 占位提示                       |

## ✨ 特性

### 1. 内置标题块（固定第一行）

✅ **特点：**

- 标题作为编辑器的**第一个固定块**（始终不变）
- 32px 大字号 + 700 粗体
- **不可删除** - 自动恢复被删除的标题块
- **不可拖拽** - 隐藏操作手柄
- **不支持斜杠菜单** - 避免转换为其他块类型
- 按 Enter 自动跳转到正文

✅ **保护机制：**

- 监听编辑器变化，确保 titleBlock 始终在第一位
- 若用户删除了所有块，自动添加段落块
- 若用户尝试移动 titleBlock，自动恢复位置

### 2. Markdown 支持

```markdown
# 一级标题

## 二级标题

### 三级标题

**粗体** _斜体_ ~~删除线~~

- 无序列表

1. 有序列表

> 引用块

\`行内代码\`

\`\`\`javascript
// 代码块
console.log('Hello');
\`\`\`
```

### 3. 斜杠命令

输入 `/` 唤起块类型菜单：

- `/p` - 段落
- `/h1` - 一级标题
- `/h2` - 二级标题
- `/ul` - 无序列表
- `/ol` - 有序列表
- `/code` - 代码块
- `/quote` - 引用

### 4. 快捷键

| 快捷键                 | 功能     |
| ---------------------- | -------- |
| `Cmd/Ctrl + B`         | 粗体     |
| `Cmd/Ctrl + I`         | 斜体     |
| `Cmd/Ctrl + K`         | 插入链接 |
| `Cmd/Ctrl + Z`         | 撤销     |
| `Cmd/Ctrl + Shift + Z` | 重做     |

### 5. 拖拽排序

- 鼠标悬停显示拖拽手柄
- 点击拖拽重新排序块
- 标题块不可拖拽

### 6. 图片上传

支持多种方式插入图片：

- **拖拽上传**：直接将图片拖入编辑器
- **粘贴上传**：从剪贴板粘贴图片（Ctrl/Cmd + V）
- **斜杠命令**：输入 `/image` 选择文件上传
- **工具栏**：点击图片按钮选择文件

技术实现：

- 自动上传到后端 `/api/v1/upload/image`
- 支持 5MB 以内的图片
- 支持格式：jpg、png、gif、webp 等
- 上传失败时降级为 base64 内联

```jsx
// 编辑器自动处理图片上传
<BlockNoteEditor
  value={content}
  onChange={setContent}
  // uploadFile 回调已内置
/>
```

## 🔧 自定义扩展

### 添加自定义块

```javascript
// blocks/MyCustomBlock.jsx
export const createMyCustomBlock = () => ({
  type: 'myBlock',
  propSchema: {
    text: { default: '' },
  },
  content: 'inline',
  render: (props) => {
    // 返回 DOM 结构
  },
});

// schema.js
import { createMyCustomBlock } from './blocks/MyCustomBlock.jsx';

export const createCustomSchema = () => {
  return BlockNoteSchema.create({
    blockSpecs: {
      title: createTitleBlock(),
      myBlock: createMyCustomBlock(), // 添加自定义块
      ...defaultBlockSpecs,
    },
    // ...
  });
};
```

### 自定义样式

编辑 `styles/editor.css`：

```css
/* 自定义标题颜色 */
.bn-title-input {
  color: #ff6b6b;
}

/* 自定义代码块主题 */
.bn-block-content[data-content-type='codeBlock'] {
  background: #2d2d2d;
}
```

## 🎨 样式定制

### CSS 变量（计划中）

```css
:root {
  --bn-primary-color: #1890ff;
  --bn-text-color: #262626;
  --bn-border-color: #e8e8e8;
  --bn-code-bg: #1e1e1e;
}
```

### 主题切换（计划中）

```jsx
<BlockNoteEditor
  theme="dark" // light | dark
  // ...
/>
```

## 🐛 已知问题

1. ~~中文输入法兼容性~~ ✅ 已修复
2. ~~行间距过大~~ ✅ 已优化
3. 表格编辑体验待优化
4. 协作编辑功能待开发

## 📝 更新日志

### v1.1.0 (2025-01-30)

- ✅ 添加图片上传功能（拖拽/粘贴/选择）
- ✅ 集成后端 API `/api/v1/upload/image`
- ✅ 5MB 文件大小限制
- ✅ 上传失败时 base64 降级

### v1.0.0 (2025-01-30)

- ✅ 重构代码到独立 blocknote 模块
- ✅ 实现内置标题块
- ✅ 修复中文输入问题
- ✅ 优化行间距和样式
- ✅ 添加完整文档

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可

MIT License
