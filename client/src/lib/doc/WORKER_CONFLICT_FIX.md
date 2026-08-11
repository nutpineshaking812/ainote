# 解决 Worker 实例冲突

## 问题

重构前存在**两个独立的 Worker 实例**：

```
LocalDatabaseManager
    ↓
创建 Worker #1

ResourceCache
    ↓
创建 Worker #2
```

这导致：

- ❌ 两个独立的数据库连接
- ❌ 资源浪费（双倍内存、双倍初始化）
- ❌ 可能的数据不一致

## 解决方案

**LocalDatabaseManager 作为唯一的 Worker 访问点**：

```
LocalDatabaseManager (Singleton)
    ↓
创建 Worker #1 (唯一实例)
    ↑         ↑
    │         │
    │    ResourceCache
    │    (使用 localDb)
    │
其他模块
(使用 localDb)
```

## 修改内容

### 1. 增强 LocalDatabaseManager

**新增 `sendMessage()` 方法**：

```typescript
export class LocalDatabaseManager {
  // ... existing code ...

  /**
   * Send custom message to worker (for business operations)
   */
  public async sendMessage(type: string, payload: any = {}): Promise<any> {
    if (!this.isInitialized) await this.initialize();

    const id = uuidv4();
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker?.postMessage({ type, id, ...payload });
    });
  }

  // 辅助方法
  public getWorker(): Worker | null { ... }
  public isReady(): boolean { ... }
}
```

**支持两种返回格式**：

```typescript
// onmessage handler
const { type, id, results, data, error } = event.data;

if (type === 'SUCCESS') {
  // Support both 'results' (SQL) and 'data' (business ops)
  request.resolve(data !== undefined ? data : results);
}
```

### 2. 简化 ResourceCache

**Before (91 lines)**:

```typescript
export class ResourceCache {
  private worker: Worker | null = null;
  private pendingRequests: Map<...> = new Map();
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  async initialize() {
    // 60+ lines of worker setup
  }

  private async sendMessage() {
    // UUID generation, promise handling
  }
}
```

**After (40 lines)**:

```typescript
import { localDb } from '../local-db/LocalDatabaseManager';

export class ResourceCache {
  private subscribers: Map<...> = new Map();

  async initialize() {
    await localDb.initialize();
  }

  private async sendMessage(type: string, payload: any) {
    return localDb.sendMessage(type, payload);
  }
}
```

## 优势

### 1. 单一 Worker 实例

```
Before: LocalDatabaseManager Worker + ResourceCache Worker = 2 Workers
After:  LocalDatabaseManager Worker = 1 Worker
```

### 2. 统一初始化

```typescript
// App initialization
await localDb.initialize(); // 所有模块共享

// ResourceCache 自动使用已初始化的 Worker
const cache = ResourceCache.getInstance();
await cache.initialize(); // 委托给 localDb
```

### 3. 代码简化

- ResourceCache 减少 51 行代码
- 移除重复的 Worker 管理逻辑
- 更清晰的职责分离

### 4. 一致的接口

**SQL 查询：**

```typescript
await localDb.query('SELECT * FROM resources WHERE appId = ?', [appId]);
```

**业务操作：**

```typescript
await localDb.sendMessage('RESOURCES_GET_ALL', { appId });
```

**两者都通过同一个 Worker！**

## 架构图

```
┌───────────────────────────────────────────────┐
│          React Application                    │
└───────────────┬───────────────────────────────┘
                │
        ┌───────┴────────┐
        │                │
        ▼                ▼
┌──────────────┐  ┌──────────────┐
│ LocalDB      │  │ ResourceCache│
│ Context      │  │              │
└──────┬───────┘  └──────┬───────┘
       │                 │
       └────────┬────────┘
                │
                ▼
    ┌────────────────────────┐
    │  LocalDatabaseManager  │ ← Singleton
    │  (统一 Worker 访问点)   │
    └───────────┬────────────┘
                │
                ▼
    ┌────────────────────────┐
    │  LocalDatabaseWorker   │ ← 唯一 Worker 实例
    │  (SQLite WASM)         │
    └───────────┬────────────┘
                │
                ▼
    ┌────────────────────────┐
    │  /local.db             │
    │  ├── resources         │
    │  ├── form_drafts       │
    │  └── ...               │
    └────────────────────────┘
```

## 测试验证

重启开发服务器后，检查控制台：

**应该只看到一次初始化：**

```
[LocalDB] SQLite3 initialized
[LocalDB] OPFS database opened
[LocalDB] All repositories initialized
[LocalDB] Manager initialized successfully
```

**不应该看到重复的初始化日志！**

## 兼容性

所有现有功能保持不变：

✅ 资源缓存正常工作
✅ LocalDatabaseContext 正常工作
✅ 所有业务操作正常
✅ 性能提升（减少一个 Worker 实例）

## 未来扩展

新模块可以直接使用 `localDb`：

```typescript
// 新的业务管理器
export class FormDraftsManager {
  async saveDraft(draft: FormDraft) {
    await localDb.sendMessage('DRAFTS_SAVE', { draft });
  }

  async getDrafts(formId: string) {
    return localDb.sendMessage('DRAFTS_GET_BY_FORM', { formId });
  }
}
```

无需创建新的 Worker 实例！
