# 🚀 后端开发规范指南 (Backend Development Standards)

本文档定义了低代码平台后端开发的架构设计、接口准则及数据库操作规范。所有开发者（及 AI 协作助手）需严格遵守。

---

## 1. 核心分层架构 (Layering)

系统遵循严格的 Repository 模式，禁止跨层读写：

1.  **Repository (仓储层)**: 封装 SQL 逻辑及 Drizzle 语法。唯一有权访问数据库的层。
2.  **Service (服务层)**: 业务大脑。负责跨 Repo 处理、权限校验。**严禁包含任何 Drizzle 语法、SQL 变量或查询/排序闭包。**
3.  **Controller (接口层)**: **极致轻量化 (Thin Controller)**。仅负责请求解析、参数握手、调用 Service 并分发响应。严禁涉及业务逻辑或定义中间变量。
4.  **Routes (路由层)**: 定义 API 入口及关联权限中间件。

---

## 2. API 设计准则 (API Design)

为了提高 API 的可维护性和兼容性，我们采用 **“显式动作路由”** 风格。

### 2.1 动词与方法约束
*   **仅使用 GET 和 POST**：原则上弃用 PUT 和 DELETE 方法，以规避某些网关的兼容性问题并简化路由逻辑。
*   **语义化动作**：行为必须在路径中显式定义，严禁在同一路径下仅靠 HTTP Verb 区分行为。

### 2.2 命名规范
*   **路径命名**：`/get-list`, `/get-detail`, `/create`, `/update`, `/delete`。
*   **方法命名**：控制器方法应具备业务语义，如 `getKnowledgeSets`, `updateKnowledgeSet`。

### 2.3 参数传递约定
*   **核心 ID 显式化 (Core ID Offloading)**: 在 Controller 层**必须**显式提取 `appId`, `id`, `userId` 等决定操作上下文的关键 ID。
*   **GET 请求**: 数据（包括 ID）通过 `req.query` 传递。
*   **POST 请求**:
    *   主业务数据通过 `req.body` 传递。
    *   应用级上下文（如 `appId`）从 `req.params` 中提取。

### 2.4 响应规范 (Response Standards)
*   **统一响应工具**：必须使用 `import { sendSuccess } from '../utils/response.js';` 返回成功数据。
*   **严禁直接使用 `res.json`**：为了保证响应结构的 `success: true` 包裹一致性。

### 2.5 参数解构策略 (Destructuring Policy) —— **强制要求**
*   **分层负责制**：
    *   **简单场景 (<= 5 字段)**: 建议在 Controller 和 Service **双重解构**，实现极致的类型安全和文档化。
    *   **复杂场景 (大表单)**: Controller 只提取核心 ID，具体业务字段在 Service 的函数签名中进行**显式解构**。
*   **禁止黑盒传递**: 禁止将 `req.body` 作为一个未知的 Object 直接在 Service 内部进行黑盒操作（如 `...body` 直推入库）。
*   **目的**: 确保维护者通过阅读 Service 代码即可获知完整的入参契约。

---

## 3. 数据库准则 (Drizzle & PostgreSQL)

### 3.1 Schema 隔离
*   **lc Schema**: 所有业务表必须定义在 `lc` schema 下（引入自 `./_base.js` 的 `mySchema`）。
*   **Snake Case**: 数据库表名、字段名统一使用小写下划线命名。

### 3.2 数据兼容性适配
*   **ID 映射**: 查询结果**必须**经过 `db/utils.js` 中的 `mapResponse` 处理，将 `id` (UUID) 映射为 `_id` 兼容前端。
*   **日期强制转换**: 涉及日期时间字段，优先使用 `timestampCoerced` 以自动转换 ISO 字符串和 Date 对象。

### 3.3 开发工作流
1.  修改 `db/schema/*.js` 定义。
2.  运行 `npm run db:generate` 生成 SQL。
3.  运行 `npm run db:push` 同步开发环境。

---

## 4. 异常处理与安全 (Error & Security)

### 4.1 异步处理
*   所有 Controller 方法必须使用 `express-async-handler` 包装，避免手动编写 `try-catch` 及 `next(err)`。

### 4.2 认证与权限
*   受保护路由必须挂载 `protect` 中间件。
*   涉及应用资源操作，必须在 Service 层调用 `accessService` 确保用户具备对应应用的访问/管理权限。

---

## 5. 代码示例 (Example)

```javascript
// Route
router.post('/update', controller.updateItem);

// Controller
import { sendSuccess } from '../utils/response.js';

/**
 * 规范：Service 方法必须显式解构参数，禁止传递模糊的 data/body 对象。
 */
export const updateItem = async (id, { name, role, tags }, userId) => {
  await repository.findById(id);
  return repository.update(id, { name, role, tags, updatedBy: userId });
};
```

---

*Last Updated: 2026-04-17*
