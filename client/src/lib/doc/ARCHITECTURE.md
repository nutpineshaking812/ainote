# 统一数据库架构图

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      React 应用层                            │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ 资源树组件   │  │  表单编辑器   │  │   文档查看器      │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘  │
└─────────┼────────────────┼─────────────────────┼───────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      业务管理层                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Resource    │  │  FormDrafts  │  │  DocumentCache   │  │
│  │ Cache       │  │  Manager     │  │  Manager         │  │
│  │ (已实现)     │  │  (未来)      │  │  (未来)          │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘  │
└─────────┼────────────────┼─────────────────────┼───────────┘
          │                │                     │
          └────────────────┼─────────────────────┘
                           │
                           ▼
          ┌─────────────────────────────────────┐
          │   LocalDatabaseWorker (统一入口)     │
          │   - 消息路由                         │
          │   - 数据库生命周期管理                │
          │   - Repository 协调                  │
          └────────────┬────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Resources  │ │  FormDrafts  │ │  Document    │
│   Repository │ │  Repository  │ │  Cache Repo  │
│  (已实现)     │ │  (未来)      │ │  (未来)      │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │   SQLite WASM    │
              │   /local.db      │
              │                  │
              │  ┌─────────────┐ │
              │  │ resources   │ │
              │  ├─────────────┤ │
              │  │ form_drafts │ │
              │  ├─────────────┤ │
              │  │ docs_cache  │ │
              │  └─────────────┘ │
              └──────────────────┘
```

## 消息流

### 资源缓存示例

```
useResourceCache (Hook)
    │
    │ getResources(appId, { mode: 'cache-first' })
    ▼
ResourceCache (Manager)
    │
    │ 1. getFromCache(appId)
    ├────────────────────────────►
    │                             │
    │                             postMessage('RESOURCES_GET_ALL', { appId })
    │                             │
    │                             ▼
    │                    LocalDatabaseWorker
    │                             │
    │                             resourcesRepo.getAll(appId)
    │                             │
    │                             ▼
    │                    ResourcesRepository
    │                             │
    │                             SELECT * FROM resources WHERE appId = ?
    │                             │
    │                             ▼
    │                        SQLite Database
    │                             │
    │   返回缓存数据 ◄──────────────┘
    │◄────────────────────────────┘
    │
    │ 2. syncFromNetwork(appId) [后台]
    ├────────────────────►
    │                     │
    │                     GET /api/apps/:appId/resources/sync
    │                     │
    │                     ▼
    │                服务器返回更新
    │                     │
    │                     postMessage('RESOURCES_UPSERT_BATCH', {...})
    │                     │
    │                     ▼
    │            LocalDatabaseWorker
    │                     │
    │            resourcesRepo.upsertBatch(...)
    │                     │
    │                     ▼
    │            INSERT OR REPLACE INTO resources ...
    │                     │
    │   更新完成 ◄─────────┘
    │◄────────────────────┘
    │
    │ 3. notifySubscribers()
    ├──► 所有订阅者收到更新通知
```

## Repository 模式详解

### 为什么使用 Repository？

**传统方式（已删除）：**

```typescript
// Worker 中直接写 SQL（耦合度高）
case 'GET_ALL':
  const results = [];
  db.exec({
    sql: 'SELECT * FROM resources WHERE appId = ?',
    bind: [appId],
    callback: (row) => results.push(row),
  });
  break;
```

**Repository 模式（现在）：**

```typescript
// Worker 中调用 Repository（解耦）
case 'RESOURCES_GET_ALL':
  const resources = resourcesRepo.getAll(appId);
  postMessage({ type: 'SUCCESS', id, data: resources });
  break;

// Repository 封装具体实现
class ResourcesRepository {
  getAll(appId: string): ResourceItem[] {
    // SQL 逻辑封装在这里
    // 类型转换逻辑封装在这里
    // 可以轻松添加缓存、日志等
  }
}
```

### Repository 职责

```
ResourcesRepository
├── 数据访问逻辑
│   ├── SQL 查询构建
│   ├── 参数绑定
│   └── 结果映射
│
├── 业务规则
│   ├── 数据验证
│   ├── 默认值处理
│   └── 格式转换
│
└── 单一职责
    └── 只负责 resources 相关的数据操作
```

## 扩展性示例

### 添加新模块（表单草稿）

**步骤 1：创建 Repository**

```typescript
// repositories/FormDraftsRepository.ts
export class FormDraftsRepository {
  constructor(private db: any) {}

  initTable() {
    /* 创建表 */
  }
  save(draft: FormDraft) {
    /* 保存草稿 */
  }
  getByUser(userId: string) {
    /* 获取草稿列表 */
  }
  delete(draftId: string) {
    /* 删除草稿 */
  }
}
```

**步骤 2：在 Worker 中注册**

```typescript
// LocalDatabaseWorker.ts
import { FormDraftsRepository } from './repositories/FormDraftsRepository';

let formDraftsRepo: FormDraftsRepository | null = null;

const initDb = async () => {
  // ... 初始化 ...
  formDraftsRepo = new FormDraftsRepository(db);
  formDraftsRepo.initTable();
};

// 添加消息处理
case 'DRAFTS_SAVE':
  formDraftsRepo.save(draft);
  break;
```

**步骤 3：创建 Manager**

```typescript
// form-drafts/FormDraftsManager.ts
export class FormDraftsManager {
  private worker: Worker;

  async saveDraft(draft: FormDraft) {
    await this.sendMessage('DRAFTS_SAVE', { draft });
  }
}
```

**步骤 4：使用**

```typescript
// React Hook
function useFormDrafts(formId: string) {
  const manager = FormDraftsManager.getInstance();
  const [drafts, setDrafts] = useState([]);

  useEffect(() => {
    manager.getDrafts(formId).then(setDrafts);
  }, [formId]);

  return { drafts, saveDraft: manager.saveDraft };
}
```

## 核心优势总结

### 1. 统一管理

```
一个数据库 → 一个 Worker → 多个 Repository
```

### 2. 职责清晰

```
Worker   : 消息路由 + 生命周期
Repository : 数据访问 + 业务逻辑
Manager  : 缓存策略 + 网络同步
Hook     : React 集成 + 状态管理
```

### 3. 易于测试

```typescript
// Repository 可以独立测试
const repo = new ResourcesRepository(mockDb);
const resources = repo.getAll('app-123');
expect(resources).toHaveLength(5);
```

### 4. 类型安全

```typescript
// 完整的 TypeScript 类型链
ResourceItem → Repository → Worker → Manager → Hook → Component
```

### 5. 性能优化

```
单一 Worker 实例 → 减少内存占用
单一数据库连接 → 减少初始化开销
Repository 缓存 → 可选的内存缓存层
```

## 对比：重构前 vs 重构后

| 特性        | 重构前     | 重构后          |
| ----------- | ---------- | --------------- |
| Worker 数量 | 2 个独立   | 1 个统一        |
| 数据库文件  | 2 个       | 1 个            |
| 同步元数据  | 独立表     | 字段内嵌        |
| 代码结构    | 扁平化     | 分层清晰        |
| 扩展性      | 需复制代码 | 添加 Repository |
| 类型安全    | 部分       | 完整            |
| 测试友好度  | 中         | 高              |

## 未来路线图

```
Phase 1 (已完成)
├── ✅ 统一数据库架构
├── ✅ ResourcesRepository 实现
├── ✅ 资源缓存功能迁移
└── ✅ 文档完善

Phase 2 (规划中)
├── [ ] FormDraftsRepository
├── [ ] 表单自动保存
└── [ ] 草稿恢复功能

Phase 3 (未来)
├── [ ] DocumentCacheRepository
├── [ ] 富文本离线编辑
└── [ ] 冲突解决机制
```
