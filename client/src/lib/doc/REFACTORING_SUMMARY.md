# 统一数据库架构 - 重构完成

## ✅ 已完成的工作

### 1. 创建 Repository 层

**新增文件：`src/lib/local-db/repositories/ResourcesRepository.ts`**

职责：

- 封装所有资源缓存相关的数据库操作
- 提供类型安全的接口
- 管理 `resources` 表的 CRUD 操作
- 内置同步时间戳管理（通过 `lastSyncAt` 字段）

核心方法：

```typescript
class ResourcesRepository {
  initTable(); // 初始化表结构
  getAll(appId): ResourceItem[]; // 获取所有资源
  upsertBatch(appId, items, syncTime); // 批量更新
  clearApp(appId); // 清除应用缓存
  getLastSyncTime(appId): string; // 获取最后同步时间
}
```

### 2. 重构 LocalDatabaseWorker

**修改文件：`src/lib/local-db/LocalDatabaseWorker.ts`**

改进：

- ✅ 保留通用 SQL 接口（`EXEC`、`QUERY`）
- ✅ 添加资源缓存专用操作（`RESOURCES_*`）
- ✅ 使用 Repository 模式分离业务逻辑
- ✅ 统一日志格式 `[LocalDB]`
- ✅ 为未来扩展预留注释示例

### 3. 更新 ResourceCache

**修改文件：`src/lib/resource-cache/ResourceCache.ts`**

改动：

- ✅ Worker 路径改为 `../local-db/LocalDatabaseWorker.ts`
- ✅ 消息类型统一使用 `RESOURCES_` 前缀
- ✅ 简化同步逻辑（Repository 内部管理时间戳）

### 4. 删除冗余文件

**删除文件：`src/lib/resource-cache/ResourceCacheWorker.ts`**

原因：功能已合并到统一的 LocalDatabaseWorker

## 📦 新架构

```
统一数据库 (/local.db)
│
├── LocalDatabaseWorker.ts (统一入口)
│   ├── 通用 SQL 接口 (EXEC/QUERY)
│   └── 业务操作路由 (RESOURCES_*/DRAFTS_*/DOCS_*)
│
├── repositories/
│   ├── ResourcesRepository.ts (资源缓存)
│   ├── FormDraftsRepository.ts (未来: 表单草稿)
│   └── DocumentCacheRepository.ts (未来: 文档缓存)
│
└── ResourceCache.ts (业务层管理器)
```

## 🎯 架构优势

### 1. 统一管理

- ✅ 所有数据在一个数据库 `/local.db`
- ✅ 单一 Worker 实例，节省资源
- ✅ 跨模块事务支持

### 2. 关注点分离

- ✅ Worker：消息路由和数据库生命周期
- ✅ Repository：具体业务的数据访问逻辑
- ✅ Manager：缓存策略和网络同步

### 3. 易于扩展

添加新功能只需三步：

```typescript
// 1. 创建 Repository
class FormDraftsRepository {
  initTable() { /* SQL */ }
  save(draft) { /* ... */ }
}

// 2. 在 Worker 中注册
let formDraftsRepo: FormDraftsRepository | null = null;
formDraftsRepo = new FormDraftsRepository(db);
formDraftsRepo.initTable();

// 3. 添加消息处理
case 'DFAFTS_SAVE':
  formDraftsRepo.save(draftId, data);
  break;
```

### 4. 消除重复

- ❌ 删除了重复的 SQLite 初始化代码
- ❌ 删除了单独的 sync_metadata 表
- ✅ 通过 `lastSyncAt` 字段直接管理同步时间

## 📋 数据库结构

### resources 表

```sql
CREATE TABLE resources (
  id TEXT PRIMARY KEY,
  appId TEXT NOT NULL,
  parentId TEXT,
  type TEXT NOT NULL,
  refId TEXT NOT NULL,
  "order" INTEGER,
  hidden INTEGER DEFAULT 0,
  pinned INTEGER DEFAULT 0,
  isLeaf INTEGER,
  metaName TEXT,
  metaDesc TEXT,
  metaIcon TEXT,
  updatedAt TEXT,
  lastSyncAt TEXT,      -- 同步时间戳（替代 sync_metadata 表）
  rawData TEXT
);

-- 索引
CREATE INDEX idx_resources_app ON resources(appId);
CREATE INDEX idx_resources_app_parent ON resources(appId, parentId);
CREATE INDEX idx_resources_updated ON resources(appId, updatedAt);
```

## 🔌 API 变化

### Worker 消息类型

| 旧类型          | 新类型                    | 说明                 |
| --------------- | ------------------------- | -------------------- |
| `GET_ALL`       | `RESOURCES_GET_ALL`       | 增加前缀避免命名冲突 |
| `UPSERT_BATCH`  | `RESOURCES_UPSERT_BATCH`  | 同上                 |
| `CLEAR_APP`     | `RESOURCES_CLEAR_APP`     | 同上                 |
| `GET_SYNC_TIME` | `RESOURCES_GET_SYNC_TIME` | 同上                 |
| `SET_SYNC_TIME` | ~~删除~~                  | 合并到 UPSERT_BATCH  |

### 简化的同步流程

**之前：**

```typescript
await sendMessage('UPSERT_BATCH', { items });
await sendMessage('SET_SYNC_TIME', { timestamp });
```

**现在：**

```typescript
await sendMessage('RESOURCES_UPSERT_BATCH', {
  items,
  syncTimestamp, // 一次调用完成
});
```

## 🧪 测试验证

重启开发服务器后，验证：

1. **资源缓存功能正常**
   - 打开应用详情页
   - 资源树正确加载
   - 后台同步正常工作

2. **控制台日志**

   ```
   [LocalDB] SQLite3 initialized
   [LocalDB] OPFS database opened
   [LocalDB] All repositories initialized
   [ResourceCache] Initialized successfully
   ```

3. **数据持久化**
   - 刷新页面后数据仍存在
   - DevTools → Application → IndexedDB 查看 `/local.db`

## 📚 未来扩展示例

### 添加表单草稿功能

**1. 创建 Repository**

```typescript
// src/lib/local-db/repositories/FormDraftsRepository.ts
export class FormDraftsRepository {
  constructor(private db: any) {}

  initTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS form_drafts (
        id TEXT PRIMARY KEY,
        formId TEXT NOT NULL,
        userId TEXT NOT NULL,
        data TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );
    `);
  }

  save(draft: FormDraft) {
    this.db.exec({
      sql: `INSERT OR REPLACE INTO form_drafts 
            (id, formId, userId, data, updatedAt) 
            VALUES (?, ?, ?, ?, ?)`,
      bind: [
        draft.id,
        draft.formId,
        draft.userId,
        JSON.stringify(draft.data),
        new Date().toISOString(),
      ],
    });
  }

  getByForm(formId: string): FormDraft[] {
    const results: FormDraft[] = [];
    this.db.exec({
      sql: 'SELECT * FROM form_drafts WHERE formId = ?',
      bind: [formId],
      rowMode: 'object',
      callback: (row: any) => results.push(this._rowToDraft(row)),
    });
    return results;
  }
}
```

**2. 在 Worker 中注册**

```typescript
// LocalDatabaseWorker.ts
import { FormDraftsRepository } from './repositories/FormDraftsRepository';

let formDraftsRepo: FormDraftsRepository | null = null;

const initDb = async () => {
  // ... 初始化数据库 ...

  formDraftsRepo = new FormDraftsRepository(db);
  formDraftsRepo.initTable();
};

// 添加消息处理
case 'DRAFTS_SAVE':
  if (!formDraftsRepo) throw new Error('FormDraftsRepository not initialized');
  formDraftsRepo.save(draft);
  postMessage({ type: 'SUCCESS', id });
  break;

case 'DRAFTS_GET_BY_FORM':
  if (!formDraftsRepo) throw new Error('FormDraftsRepository not initialized');
  const drafts = formDraftsRepo.getByForm(formId);
  postMessage({ type: 'SUCCESS', id, data: drafts });
  break;
```

**3. 创建业务管理器**

```typescript
// src/lib/form-drafts/FormDraftsManager.ts
export class FormDraftsManager {
  async saveDraft(formId: string, data: any): Promise<void> {
    const worker = getLocalDatabaseWorker();
    await sendMessage(worker, 'DRAFTS_SAVE', {
      draft: { id: uuid(), formId, data },
    });
  }
}
```

## 📝 代码质量检查清单

- [x] Repository 模式正确实现
- [x] Worker 消息类型统一命名前缀
- [x] 删除冗余代码和文件
- [x] 类型安全（TypeScript）
- [x] 错误处理完善
- [x] 日志输出统一
- [x] 预留未来扩展接口
- [x] 文档更新

## 🎉 总结

重构完成！现在拥有一个**统一、可扩展、高内聚低耦合**的本地数据库架构。

核心亮点：

- 📦 **单一数据库**：所有数据在 `/local.db`
- 🏗️ **Repository 模式**：业务逻辑封装清晰
- 🔌 **统一入口**：LocalDatabaseWorker 作为消息路由
- 🚀 **易于扩展**：添加新功能只需新建 Repository
- 🧹 **无冗余**：删除重复代码和独立 Worker
