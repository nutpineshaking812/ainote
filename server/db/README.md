# 🛡️ 数据库架构与准则 (Drizzle ORM)

本文档定义了 AINote 平台后端数据库架构的核心准则，所有未来的开发、修改以及 AI 协作者均需严格遵守。

## 1. 核心架构逻辑 (Architecture)

我们采用了 **“渐进式解耦”** 的架构，目前处于 MongoDB 向 PostgreSQL 迁移的过渡期。
*   **PostgreSQL**: 负责高性能业务数据（如 UserProperty, Workflow）。
*   **Drizzle ORM**: 所有的 PostgreSQL 交互均通过 Drizzle 以声明式 (Declarative) 方式进行。
*   **Schema 隔离**: 所有业务表必须放置在 `lc` (AINote) Schema 文件夹下，不得直接操作 `public` Schema（避免干扰第三方库如 mem0）。

---

## 2. 文件夹组织准则 (Directory Standards)

### 📂 `db/schema/` (定义层)
*   **原则**: 模块化分块（Modular Schema）。
*   **基础**: 通用的 `pgSchema` 必须引自 `_base.js`。
*   **入口**: 新建表文件后，必须在 `schema/index.js` 中重新导出（Re-export），以便 Drizzle 全局感知。

### 📂 `db/migrations/` (迁移层)
*   **原则**: 此文件夹是数据库的“Git 记录”。
*   **提交**: **必须将此文件夹提交到 Git**，否则会导致多人协作时数据库版本冲突。

---

## 3. 开发流程准则 (Development Workflow)

> **⚠️ 严禁手动登录数据库 (GUI 或命令行) 直接修改表结构 (ALTER TABLE)。**

所有变更应遵循以下标准流程：

1.  **修改代码**: 在 `db/schema/*.js` 中修改或新增表定义。
2.  **生成脚本**: 运行 `npm run db:generate` 生成 SQL 迁移文件和快照。
3.  **同步开发库**: 运行 `npm run db:push` 立即同步本地开发数据库。
4.  **提交 Git**: 将代码和生成的 `migrations/` 文件夹一起提交。

---

## 4. 常用运维命令 (Scripts)

| 命令 | 用途 | 适用场景 |
| :--- | :--- | :--- |
| `npm run db:push` | **极速同步** | 本地开发，快速迭代架构。 |
| `npm run db:generate` | **生成迁移** | 准备提交代码，为生产环境生成 SQL。 |
| `npm run db:migrate` | **应用迁移** | 生产环境同步架构。 |
| `npm run db:pull` | **结构找回** | 数据库与代码不一致时，反向拉取真相。 |

---

## 5. 命名规范

*   **表名**: 小写下划线 (Snake Case)。
*   **字段名**: 小写下划线 (Snake Case)。
*   **对象名**: 驼峰命名 (Camel Case)，例如 `userProperties`。
*   **Schema**: 始终引用 `mySchema` (即 `lc` schema)。

---

## 6. 未来扩展示例

如果你要增加一个 `orders` 表，请按照下述步骤：
1.  创建 `db/schema/orders.js`。
2.  从 `./_base.js` 引入 `mySchema` 定义表。
3.  在 `db/schema/index.js` 中 `export * from './orders.js'`。
4.  运行 `npm run db:generate`。

---

## 7. 进阶避坑与预防措施 (Pitfalls & Prevention)

为应对项目规模急剧扩大（>100 张表或 >100w 行数据），请遵循以下预防措施：

### 🚨 风险 1: 大表锁表风险 (Table Locking)
*   **现象**: 在已有千万级数据的表上 `ADD COLUMN` 或 `CREATE INDEX`，可能导致数据库锁死数分钟。
*   **预防**: 生产环境执行 `npm run db:migrate` 前，需人工审查生成的 SQL。如有超大表，建议使用 `CONCURRENTLY` 创建索引或在业务低峰期执行。

### 🚨 风险 2: 循环引用陷阱 (Circular Reference)
*   **现象**: 表 A 引用了表 B，表 B 的关联关系又引用了表 A，导致 Node.js 启动失败。
*   **预防**: 如果表关联（Relations）极其复杂，切勿在表定义文件中写 `import`。建议创建一个 `db/schema/relations.js` 文件，集中定义所有表的关联逻辑。

### 🚨 风险 3: 枚举类型混乱 (Enums Proliferation)
*   **现象**: 多个表文件中重复定义相同的 `pgEnum`，导致 Drizzle 重复生成 SQL 脚本。
*   **预防**: 所有的枚举值（如：状态项、角色名）统一定义在 `db/schema/_enums.js` 中，通过 `import` 到各表使用。

### 🚨 风险 4: 数据库连接池耗尽 (Connection Exhaustion)
*   **现象**: 请求量激增时，后端报错 `Too many connections`。
*   **预防**: 
    1. 监控 `server/config/postgres.js` 中的 `Pool` 大小。
    2. 当规模扩大后，考虑引入 **PgBouncer** 作为连接池中间层。

### 🚨 风险 5: 误删 Schema 以外的表
*   **现象**: 在没有正确配置 `schemaFilter` 的情况下运行 `db:push`。
*   **预防**: **绝对不要修改** `drizzle.config.js` 中的 `schemaFilter: ["lc"]` 这一项。这是保护 `public` Schema（存储第三方表）的唯一屏障。

---

## 8. 数据转换与兼容性 (Data Mapping)

为保证前端在从 MongoDB 迁移到 PostgreSQL 过程中的稳定性，我们采用了 **“双向数据适配”** 策略：

### 8.1 响应 ID 映射 (Output Mapping)
*   **原则**: 所有的数据库查询结果 **必须** 经过 `server/db/utils.js` 中的 `mapResponse` 函数处理。
*   **作用**: 该函数会自动将 PostgreSQL 的 `id` (UUID) 映射为 `_id` 别名，确保前端列表、路由和状态管理逻辑无需重构即可运行。

### 8.2 智能日期转换 (Date Coercion)
*   **原则**: 对于从 Temporal 流程或前端 REST API 接收的日期数据，Schema 中应优先使用 `timestampCoerced` 自定义类型。
*   **作用**: 解决 Drizzle 原生 `timestamp` 无法直接处理 ISO 字符串导致 `toISOString is not a function` 报错的问题。它会在入库前自动将 `string` 转换为 `Date` 对象。
*   **示例**:
    ```javascript
    import { timestampCoerced } from './_base.js';
    export const workflows = mySchema.table('workflows', {
      createdAt: timestampCoerced('created_at').default(sql`now()`),
    });
    ```


## 9. 分层分工与读写隔离 (Layering & Responsibility)

为了项目的长期可预测性和可维护性，我们严格执行 **Repository 模式**，禁止越层操作：

### 🚫 严禁越层读写 (Strict Isolation)
*   **Service & Controller 层**: **禁止** 直接引用 `db/index.js` 或 Drizzle 的 `db` 实例。
*   **SQL 逻辑**: **禁止** 在 Service 层手写 Drizzle 查询语句、SQL 片段或事务逻辑。所有的持久化细节必须封装在 `repositories/` 下。

### ✅ 核心层级职责
1.  **Repository (仓储层)**: **唯一** 有权直接与数据库对话的层次。负责 SQL 构造、结果转换 (`mapResponse`) 和数据原子操作。
2.  **Service (服务层)**: 核心业务大脑。负责跨 Repo 处理、权限校验、逻辑分支以及与第三方服务（如 Temporal, AI SDK）的整合。
3.  **Controller (接口层)**: 负责请求验证、参数解析和响应格式化。严禁感知数据库的存在。

### 📌 为什么要这样做？
1.  **迁移无忧**: 未来切换任意数据库，只需修改 `Repository`，`Service` 无需改动。
2.  **可测试性**: 可以在不启动数据库的情况下，通过 Mock Repository 对业务逻辑进行 100% 的单元测试。
3.  **强制兼容性**: 通过 Repository 统一出口，保证 `_id` 等兼容性逻辑永不遗漏。

---

*这份准则由 Antigravity 协助建立，旨在为了构建一个健壮、可维护且专业的 AINote 平台底层。*
