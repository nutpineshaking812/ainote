# 消息类型常量管理

## 改进内容

将所有 Worker 消息类型统一定义在 `messageTypes.ts` 文件中，避免硬编码字符串。

## 文件结构

```
src/lib/local-db/
├── messageTypes.ts           ← 新增：消息类型常量
├── LocalDatabaseWorker.ts    ← 使用常量
├── LocalDatabaseManager.ts   ← 使用常量
└── repositories/
    └── ResourcesRepository.ts

src/lib/resource-cache/
└── ResourceCache.ts          ← 使用常量
```

## messageTypes.ts

```typescript
// 通用消息类型
export const MSG_INIT = 'INIT';
export const MSG_INIT_SUCCESS = 'INIT_SUCCESS';
export const MSG_INIT_ERROR = 'INIT_ERROR';
export const MSG_SUCCESS = 'SUCCESS';
export const MSG_ERROR = 'ERROR';

// SQL 操作
export const MSG_EXEC = 'EXEC';
export const MSG_QUERY = 'QUERY';

// 资源缓存操作
export const MSG_RESOURCES_GET_ALL = 'RESOURCES_GET_ALL';
export const MSG_RESOURCES_UPSERT_BATCH = 'RESOURCES_UPSERT_BATCH';
export const MSG_RESOURCES_CLEAR_APP = 'RESOURCES_CLEAR_APP';
export const MSG_RESOURCES_GET_SYNC_TIME = 'RESOURCES_GET_SYNC_TIME';

// 未来扩展（已注释）
// export const MSG_DRAFTS_SAVE = 'DRAFTS_SAVE';
// export const MSG_DOCS_CACHE = 'DOCS_CACHE';
```

## 优势

### 1. 类型安全

```typescript
// ❌ 之前：容易拼写错误
case 'RESOURCES_GET_AL':  // 漏了 L，编译器不会报错

// ✅ 现在：IDE 自动补全 + 编译时检查
case MSG_RESOURCES_GET_ALL:  // 如果拼错，TypeScript 会报错
```

### 2. 易于重构

```typescript
// 需要修改消息类型名称时
// ❌ 之前：需要在多个文件中查找替换字符串 'RESOURCES_GET_ALL'
// ✅ 现在：只需修改 messageTypes.ts 中的一处定义
```

### 3. 集中管理

```typescript
// 所有消息类型在一个文件中，一目了然
// 便于查看所有可用的消息类型
// 便于添加新的消息类型
```

### 4. 防止冲突

```typescript
// 命名规范统一
// MSG_ 前缀，清晰标识这是消息类型常量
// 分组注释，便于查找相关操作
```

## 使用示例

### Worker 中使用

```typescript
// LocalDatabaseWorker.ts
import { MSG_INIT, MSG_SUCCESS, MSG_RESOURCES_GET_ALL } from './messageTypes';

onmessage = async (event) => {
  const { type, id } = event.data;

  if (type === MSG_INIT) {
    // ...
  }

  switch (type) {
    case MSG_RESOURCES_GET_ALL:
      const data = resourcesRepo.getAll(appId);
      postMessage({ type: MSG_SUCCESS, id, data });
      break;
  }
};
```

### Manager 中使用

```typescript
// LocalDatabaseManager.ts
import { MSG_INIT, MSG_INIT_SUCCESS, MSG_EXEC } from './messageTypes';

worker.onmessage = (event) => {
  const { type } = event.data;

  if (type === MSG_INIT_SUCCESS) {
    // ...
  }
};

worker.postMessage({ type: MSG_INIT });
worker.postMessage({ type: MSG_EXEC, sql, params });
```

### 业务层使用

```typescript
// ResourceCache.ts
import {
  MSG_RESOURCES_GET_ALL,
  MSG_RESOURCES_UPSERT_BATCH,
} from '../local-db/messageTypes';

async getFromCache(appId: string) {
  return this.sendMessage(MSG_RESOURCES_GET_ALL, { appId });
}

async updateCache(appId: string, items: ResourceItem[]) {
  return this.sendMessage(MSG_RESOURCES_UPSERT_BATCH, { appId, items });
}
```

## 添加新消息类型

### 步骤

1. **在 `messageTypes.ts` 中定义常量**

```typescript
// 新增表单草稿操作
export const MSG_DRAFTS_SAVE = 'DRAFTS_SAVE';
export const MSG_DRAFTS_GET_BY_FORM = 'DRAFTS_GET_BY_FORM';
export const MSG_DRAFTS_DELETE = 'DRAFTS_DELETE';
```

2. **在 Worker 中导入并使用**

```typescript
import { MSG_DRAFTS_SAVE, MSG_DRAFTS_GET_BY_FORM } from './messageTypes';

switch (type) {
  case MSG_DRAFTS_SAVE:
    formDraftsRepo.save(draft);
    postMessage({ type: MSG_SUCCESS, id });
    break;
}
```

3. **在业务层使用**

```typescript
import { MSG_DRAFTS_SAVE } from '../local-db/messageTypes';

async saveDraft(draft: FormDraft) {
  await localDb.sendMessage(MSG_DRAFTS_SAVE, { draft });
}
```

## 命名规范

```
格式：MSG_<模块>_<操作>

通用：
  MSG_INIT
  MSG_INIT_SUCCESS
  MSG_SUCCESS
  MSG_ERROR

SQL：
  MSG_EXEC
  MSG_QUERY

资源缓存：
  MSG_RESOURCES_GET_ALL
  MSG_RESOURCES_UPSERT_BATCH
  MSG_RESOURCES_CLEAR_APP

表单草稿（未来）：
  MSG_DRAFTS_SAVE
  MSG_DRAFTS_GET_BY_FORM
  MSG_DRAFTS_DELETE

文档缓存（未来）：
  MSG_DOCS_CACHE
  MSG_DOCS_GET
  MSG_DOCS_CLEAR
```

## 总结

✅ **类型安全**：编译时检查，减少拼写错误
✅ **易于维护**：集中管理，修改方便
✅ **可读性强**：清晰的命名和分组
✅ **自动补全**：IDE 支持良好
✅ **未来友好**：轻松添加新的消息类型
