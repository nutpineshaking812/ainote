# AiNote Chat SDK

轻量级数字员工聊天 SDK，支持 UI 集成（Dock 悬浮面板）和纯 API 编程两种使用方式。

## 目录

- [快速开始](#快速开始)
- [UI 集成（init / destroy）](#ui-集成init--destroy)
- [配置参数](#配置参数)
- [聊天模式](#聊天模式)
- [只展示指定员工](#只展示指定员工)
- [API 编程接口](#api-编程接口)
- [构建产物](#构建产物)

---

## 快速开始

SDK 将 React、ReactDOM、antd、ECharts 等重型库设为 external，页面需要预先加载它们的 UMD 版本。

```html
<!-- 1. 预加载 CDN 依赖（顺序很重要） -->
<script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/antd@6/dist/antd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@ant-design/icons@6/dist/index.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>

<!-- 2. 引入 SDK 脚本 -->
<script src="https://your-cdn.com/ainote-chat-sdk.js"></script>

<!-- 3. 放置 Dock 容器 -->
<div id="ai-dock" style="position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:9999"></div>

<!-- 4. 一行初始化 -->
<script>
AiNoteChat.init({
  appId:     'your-app-id',
  apiKey:    'sk-xxxxxxxxxxxxxxxx',
  container: '#ai-dock',
});
</script>
```

初始化后，页面右侧会出现 **"AI 协同"** 标签，点击展开 Dock 面板，选择数字员工即可开始对话。

---

## UI 集成（init / destroy）

### `AiNoteChat.init(config)`

初始化 Dock 悬浮按钮和聊天面板。

```js
const instance = AiNoteChat.init({
  // ─── 必填 ───
  appId:     'your-app-id',                  // 应用 ID
  apiKey:    'sk-xxxxxxxxxxxxxxxx',          // API Key（sk-... 或 app_sk_...）
  container: '#dock-container',              // Dock 按钮挂载点（CSS 选择器或 DOM 元素）

  // ─── 聊天模式 ───
  chatMode:      'floating',                 // 'floating' | 'fullscreen' | 'panel'
  chatContainer: '#chat-sidebar',            // panel 模式下的侧栏容器（必填）

  // ─── 可选 ───
  host:          'https://api.example.com',  // API 服务器地址（不传则使用同源）
  themeColor:    '#6366f1',                  // 主题色，默认 #6366f1
  dockPlacement: 'right',                    // Dock 位置：'left' | 'right'
  scenario:      'GENERAL',                  // 场景：GENERAL | DOCUMENT | VIEW_DESIGN
  employeeIds:   ['emp_001', 'emp_002'],     // 只展示指定 ID 的员工
  employeeId:    'emp_001',                  // 只展示单个员工（等同于 employeeIds: ['emp_001']）
  style:         {},                         // Dock 容器额外 CSS 样式
});

// 返回 { destroy: () => void }
```

### `AiNoteChat.destroy()`

销毁当前实例，卸载所有 UI，清除状态。

```js
AiNoteChat.destroy();
```

---

## 配置参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `appId` | `string` | 是 | - | 应用 ID |
| `apiKey` | `string` | 是 | - | API Key，格式 `sk-...` 或 `app_sk_...` |
| `container` | `string \| Element` | 是 | - | Dock 按钮挂载容器 |
| `chatMode` | `string` | 否 | `'floating'` | 聊天面板模式 |
| `chatContainer` | `string \| Element` | 否（panel 模式必填） | - | panel 模式下聊天渲染容器 |
| `host` | `string` | 否 | `''`（同源） | API 服务器地址 |
| `themeColor` | `string` | 否 | `'#6366f1'` | 主题色 |
| `dockPlacement` | `string` | 否 | `'right'` | Dock 位置 |
| `scenario` | `string` | 否 | `'GENERAL'` | 数字员工场景 |
| `employeeIds` | `string[]` | 否 | - | 员工白名单 |
| `employeeId` | `string` | 否 | - | 单个员工快捷方式 |
| `style` | `object` | 否 | `{}` | Dock 容器额外样式 |

---

## 聊天模式

### 1. Floating（浮动弹窗）— 默认

聊天窗口以**浮动弹窗**方式覆盖在页面上方，不影响现有布局。

```js
AiNoteChat.init({
  appId:     'your-app-id',
  apiKey:    'sk-...',
  container: '#dock-container',
  chatMode:  'floating',
});
```

### 2. Fullscreen（全屏遮罩）

聊天窗口以**全屏遮罩层**方式呈现，适合移动端或专注对话场景。

```js
AiNoteChat.init({
  appId:     'your-app-id',
  apiKey:    'sk-...',
  container: '#dock-container',
  chatMode:  'fullscreen',
});
```

### 3. Panel（侧栏内嵌）

聊天面板**嵌入**到指定 DOM 容器中，常驻显示，适合知识库、文档页等场景。

```js
AiNoteChat.init({
  appId:         'your-app-id',
  apiKey:        'sk-...',
  container:     '#dock-container',
  chatMode:      'panel',
  chatContainer: '#chat-sidebar',   // 聊天面板渲染到此处
});
```

```html
<!-- HTML 布局 -->
<div style="display:flex;">
  <div style="flex:1;">... 主体内容 ...</div>
  <div id="chat-sidebar" style="width:420px;"></div>
</div>
<div id="dock-container" style="position:fixed;right:0;z-index:9999;"></div>
```

---

## 只展示指定员工

### 单员工场景

如果你的应用只允许使用某个特定数字员工：

```js
// 方式一：单数语法糖
AiNoteChat.init({
  appId:      'your-app-id',
  apiKey:     'sk-...',
  container:  '#dock-container',
  employeeId: 'emp_assistant_001',   // 只展示这一个员工
});
```

### 多员工白名单

只展示指定的几个员工：

```js
AiNoteChat.init({
  appId:       'your-app-id',
  apiKey:      'sk-...',
  container:   '#dock-container',
  employeeIds: ['emp_writer_001', 'emp_coder_001'],
});
```

### 不传 employeeIds

默认展示**全部**数字员工（根据 `scenario` 自动过滤）。

---

## API 编程接口

不依赖 UI，纯编程方式调用数字员工 API：

```js
const api = AiNoteChat.api({
  appId:  'your-app-id',
  apiKey: 'sk-...',
  host:   'https://api.example.com',
});
```

### `api.getEmployees(opts?)`

获取数字员工列表。

```js
const employees = await api.getEmployees({ scenario: 'GENERAL' });
// => [{ id, name, roleTitle, avatar, description, scenario }]
```

### `api.sendMessage(opts)`

发送消息并接收 SSE 流式响应。

```js
await api.sendMessage({
  content:    '请帮我分析这份文档',
  employeeId: employees[0].id,
  scenario:   'DOCUMENT',

  // 流式回调
  onText:      (delta, fullText) => { console.log('文本:', fullText); },
  onThinking:  (delta, fullText) => { console.log('思考:', fullText); },
  onToolCall:  (toolName, input, callId) => { console.log('工具调用:', toolName); },
  onToolResult:(callId, output) => { console.log('工具结果:', output); },
  onDone:      ({ conversationId, messageId }) => { console.log('完成'); },
  onError:     (err) => { console.error(err); },
});
```

### `api.listConversations(opts?)`

获取会话列表。

```js
const { items, total } = await api.listConversations({
  limit:      20,
  employeeId: 'emp_001',
  scenario:   'GENERAL',
});
```

### `api.getMessages(conversationId, opts?)`

获取指定会话的消息历史。

```js
const { conversation, messages } = await api.getMessages('conv_123', { limit: 50 });
```

### `api.getSession()`

获取认证信息（Token + UserId）。

```js
const { token, userId, appId, expiresIn } = await api.getSession();
```

### `api.setToken(token, userId?)`

手动设置 JWT Token（用于已有认证的场景）。

```js
api.setToken('eyJhbGciOi...', 'user_123');
```

---

## 构建产物

```bash
cd client
VITE_API_URL='' npm run build:sdk
```

产物输出到 `dist/sdk/`：

| 文件 | 说明 |
|------|------|
| `ainote-chat-sdk.js` | 打包后的 SDK（IIFE 格式，挂载到 `window.AiNoteChat`） |
| `demo.html` | 可运行的集成示例页 |

### 体积说明

SDK 通过 external + CDN 方式优化体积，接入方需在页面中预先引入以下 CDN 脚本：

| CDN 脚本 | 全局变量 | 大小（压缩后） |
|----------|----------|----------------|
| `react@18/umd/react.production.min.js` | `window.React` | ~14 KB |
| `react-dom@18/umd/react-dom.production.min.js` | `window.ReactDOM` | ~135 KB |
| `antd@6/dist/antd.min.js` | `window.antd` | ~1.2 MB |
| `@ant-design/icons@6/dist/index.umd.min.js` | `window.icons` | ~350 KB |
| `echarts@5/dist/echarts.min.js` | `window.echarts` | ~1 MB |

SDK 自身产物约 **~2.1 MB**（含 @ant-design/x 系列、i18n、axios、dayjs + locale 及所有业务组件代码）。

> **Mermaid 图表渲染**（可选）：SDK 内置了 mermaid no-op shim，Markdown 中的 Mermaid 代码块不会渲染任何内容但也不会报错。
> 如需启用 Mermaid 图表渲染，请在页面中额外引入：
> ```html
> <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
> ```
> 注意：此脚本约 2.6 MB，请按需引入。

---

## 架构说明

```
AiNoteChat.init(config)
  ├── 鉴权：API Key → POST /open/apps/:appId/session → JWT
  │
  ├── AgentDock（Dock 悬浮面板）
  │   ├── 垂直标签「AI 协同」→ 点击展开
  │   ├── 员工头像队列（已入驻 Dock 的数字员工）
  │   ├── + 按钮 → Popover 召唤新员工
  │   └── 3 秒无操作自动折叠
  │
  └── AgentWorkspace（聊天面板）
      ├── floating  → Portal 到 body，浮动弹窗
      ├── fullscreen → Portal 到 body，全屏遮罩
      └── panel    → Portal 到 chatContainer，侧栏嵌入
```

---

## 设计原则

- **零侵入** — 不覆盖、不修改页面现有 DOM
- **Portal 渲染** — 聊天面板通过 React Portal 挂载到指定容器
- **按需加载** — 首次选择员工后才初始化聊天引擎
- **自动鉴权** — API Key 自动换取 JWT，静默续期
- **策略可切换** — internal / open 两种 API 模式，通过 `apiMode` 控制数据提供者
