# LocalDatabaseWorker vs ResourceCacheWorker 对比

## 概述

项目中存在两个 SQLite Web Worker，它们的关系和区别如下：

## 对比表

| 特性           | LocalDatabaseWorker      | ResourceCacheWorker                   |
| -------------- | ------------------------ | ------------------------------------- |
| **位置**       | `src/lib/local-db/`      | `src/lib/resource-cache/`             |
| **数据库文件** | `/local.db`              | `/resource-cache.db`                  |
| **设计目的**   | 通用数据库（未来扩展）   | 专用资源缓存                          |
| **接口类型**   | 原始 SQL（EXEC/QUERY）   | 业务操作（GET_ALL/UPSERT_BATCH）      |
| **数据模型**   | 通用 `resource_cache` 表 | 专用 `resources` + `sync_metadata` 表 |
| **是否使用**   | ❌ 当前未使用            | ✅ 活跃使用中                         |

## 详细对比

### 1. LocalDatabaseWorker（通用层）

**特点：**

- ✅ 提供原始 SQL 执行能力
- ✅ 灵活，可执行任意 SQL
- ❌ 需要手写 SQL 语句
- ❌ 没有类型安全

**API 示例：**

```typescript
// 发送原始 SQL
worker.postMessage({
  type: 'QUERY',
  sql: 'SELECT * FROM resource_cache WHERE appId = ?',
  params: ['app-123'],
});
```

**使用场景（设计中）：**

- 通用数据存储
- 需要复杂 SQL 查询
- 多种不同类型的缓存需求

### 2. ResourceCacheWorker（业务层）

**特点：**

- ✅ 专门为资源缓存设计
- ✅ 提供高级业务操作（GET_ALL, UPSERT_BATCH等）
- ✅ TypeScript 类型安全
- ✅ 内置增量同步逻辑

**API 示例：**

```typescript
// 发送业务操作
worker.postMessage({
  type: 'GET_ALL',
  appId: 'app-123',
});

worker.postMessage({
  type: 'UPSERT_BATCH',
  appId: 'app-123',
  items: [
    /* ResourceItem[] */
  ],
});
```

**使用场景（实际使用）：**

- ✅ 应用资源树缓存
- ✅ 增量同步管理
- ✅ 离线访问支持

## 架构关系图

```
┌─────────────────────────────────────────┐
│       应用详情页 / 资源树组件              │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│      useResourceCache (React Hook)      │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│     ResourceCache (管理类)               │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  ResourceCacheWorker (专用 SQLite)       │  ← 当前使用
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  LocalDatabaseWorker (通用 SQLite)       │  ← 未来扩展
└─────────────────────────────────────────┘
       △
       │ 可能的未来扩展：
       ├─ 表单数据缓存
       ├─ 文档草稿缓存
       └─ 其他离线数据
```

## 重复与冗余分析

### 是否存在重复？

**是的，存在一定的重复：**

1. **相同的依赖**：都使用 `@sqlite.org/sqlite-wasm`
2. **相同的初始化逻辑**：都是 `sqlite3InitModule()` + OPFS 检测
3. **相同的数据库类型**：都创建 SQLite 数据库

### 为什么会有两个 Worker？

根据代码历史分析：

1. **LocalDatabaseWorker** 是最初的设计
   - 想法：提供一个通用的 SQLite 抽象层
   - 特点：底层、灵活、原始 SQL 接口
   - 状态：实现了但没有被实际使用

2. **ResourceCacheWorker** 是后来的实现
   - 原因：需要专门的资源缓存功能
   - 特点：高级、业务化、类型安全
   - 状态：正在生产环境使用

## 建议的架构选择

### 方案 1：保持独立（推荐）

**优点：**

- ✅ 关注点分离
- ✅ ResourceCacheWorker 针对性优化
- ✅ LocalDatabaseWorker 为未来扩展预留

**缺点：**

- ❌ 代码重复（初始化逻辑）
- ❌ 增加维护成本

**适用场景：**

- 未来确实需要通用数据库（表单缓存、文档草稿等）
- 不同类型的数据有不同的生命周期和清理策略

### 方案 2：合并为单一 Worker

**思路：**

```
LocalDatabaseWorker (重构)
├── 通用 SQL 接口 (EXEC/QUERY)
└── 业务接口层
    ├── ResourceCache 操作
    ├── FormDraft 操作 (未来)
    └── DocumentCache 操作 (未来)
```

**优点：**

- ✅ 消除重复代码
- ✅ 单一数据库实例
- ✅ 统一管理

**缺点：**

- ❌ Worker 职责变重
- ❌ 需要重构现有代码

### 方案 3：删除未使用的 LocalDatabaseWorker（最简单）

**优点：**

- ✅ 减少代码维护负担
- ✅ 清理未使用的功能

**缺点：**

- ❌ 失去未来扩展基础
- ❌ 如需通用数据库需要重写

## 当前推荐

**保持现状（方案 1）**，原因：

1. **ResourceCacheWorker 正在工作且专门优化**
2. **LocalDatabaseWorker 可作为未来扩展基础**
3. **重构成本 > 维护成本**

未来如果需要更多缓存类型（表单草稿、文档离线等），可以：

- 选择扩展 LocalDatabaseWorker
- 或参考 ResourceCacheWorker 创建新的专用 Worker

## 重构清理建议（可选）

如果确定不需要通用数据库层，可以：

1. **删除 LocalDatabaseWorker.ts**
2. **删除 LocalDatabaseManager.ts**
3. **删除 LocalDatabaseContext.tsx**
4. **更新 App.jsx** 移除 `LocalDatabaseProvider`

这样项目结构更清晰，只保留实际使用的 ResourceCacheWorker。

## 总结

- **LocalDatabaseWorker**: 通用 SQL 接口，未来扩展用，**当前未使用**
- **ResourceCacheWorker**: 专用资源缓存，**正在生产使用**
- **关系**: 两者独立，功能有重叠但用途不同
- **建议**: 保持现状或删除未使用的 LocalDatabaseWorker
