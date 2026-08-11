# 统一数据库架构重构方案

## 目标

将 ResourceCacheWorker 合并到 LocalDatabaseWorker，所有数据保存在 `/local.db` 中。

## 架构设计

```
/local.db (统一数据库)
├── resources (资源缓存表)
├── sync_metadata (同步元数据表)
├── form_drafts (未来: 表单草稿)
├── document_cache (未来: 文档缓存)
└── user_settings (未来: 用户设置)
```

## 重构步骤

### 第一步：扩展 LocalDatabaseWorker

**文件**: `src/lib/local-db/LocalDatabaseWorker.ts`

增强功能：

1. 添加 resources 和 sync_metadata 表
2. 添加资源缓存相关的高级操作
3. 保持原有的 EXEC/QUERY 通用接口

### 第二步：更新 ResourceCache

**文件**: `src/lib/resource-cache/ResourceCache.ts`

修改 Worker 引用：

- 从 `ResourceCacheWorker` 改为 `LocalDatabaseWorker`
- 调整消息格式以适配新接口

### 第三步：删除 ResourceCacheWorker

删除文件：

- `src/lib/resource-cache/ResourceCacheWorker.ts`

### 第四步：数据迁移

由于是新功能，不需要迁移数据。用户刷新后会自动从服务器重新同步。

## 实现代码

### 1. 增强的 LocalDatabaseWorker.ts

```typescript
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { ResourceItem } from '../resource-cache/types';

let db: any = null;

const initDb = async () => {
  try {
    const sqlite3 = await sqlite3InitModule();
    console.log('[LocalDB] SQLite3 initialized');

    if ('opfs' in sqlite3) {
      db = new sqlite3.oo1.OpfsDb('/local.db');
      console.log('[LocalDB] OPFS database opened');
    } else {
      db = new sqlite3.oo1.DB('/local.db', 'ct');
      console.log('[LocalDB] In-memory database opened');
    }

    // 创建所有表
    db.exec(`
      -- 资源缓存表
      CREATE TABLE IF NOT EXISTS resources (
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
        rawData TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_resources_app ON resources(appId);
      CREATE INDEX IF NOT EXISTS idx_resources_app_parent ON resources(appId, parentId);

      -- 同步元数据表
      CREATE TABLE IF NOT EXISTS sync_metadata (
        appId TEXT PRIMARY KEY,
        lastSyncAt TEXT NOT NULL
      );

      -- 未来扩展: 表单草稿表
      CREATE TABLE IF NOT EXISTS form_drafts (
        id TEXT PRIMARY KEY,
        formId TEXT NOT NULL,
        userId TEXT NOT NULL,
        data TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );

      -- 未来扩展: 文档缓存表
      CREATE TABLE IF NOT EXISTS document_cache (
        id TEXT PRIMARY KEY,
        docId TEXT NOT NULL,
        content TEXT,
        cachedAt TEXT
      );
    `);

    postMessage({ type: 'INIT_SUCCESS' });
  } catch (error: any) {
    console.error('[LocalDB] Failed to initialize:', error);
    postMessage({ type: 'INIT_ERROR', error: error.message });
  }
};

// ============ 资源缓存操作 ============

const getAllResources = (appId: string) => {
  const results: any[] = [];
  db.exec({
    sql: 'SELECT * FROM resources WHERE appId = ? ORDER BY "order"',
    bind: [appId],
    rowMode: 'object',
    callback: (row: any) => {
      results.push({
        id: row.id,
        refId: row.refId,
        type: row.type,
        parentId: row.parentId,
        order: row.order,
        hidden: !!row.hidden,
        pinned: !!row.pinned,
        isLeaf: !!row.isLeaf,
        updatedAt: row.updatedAt,
        meta: {
          name: row.metaName || '未命名',
          desc: row.metaDesc || '',
          icon: row.metaIcon,
        },
      });
    },
  });
  return results;
};

const upsertResourcesBatch = (appId: string, items: ResourceItem[]) => {
  db.exec('BEGIN TRANSACTION');
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO resources (
        id, appId, parentId, type, refId, "order", hidden, pinned, isLeaf,
        metaName, metaDesc, metaIcon, updatedAt, rawData
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      stmt.bind([
        item.id,
        appId,
        item.parentId,
        item.type,
        item.refId,
        item.order,
        item.hidden ? 1 : 0,
        item.pinned ? 1 : 0,
        item.isLeaf ? 1 : 0,
        item.meta.name,
        item.meta.desc || '',
        item.meta.icon || null,
        item.updatedAt,
        JSON.stringify(item),
      ]);
      stmt.step();
      stmt.reset();
    }

    stmt.finalize();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

const clearAppResources = (appId: string) => {
  db.exec({ sql: 'DELETE FROM resources WHERE appId = ?', bind: [appId] });
  db.exec({ sql: 'DELETE FROM sync_metadata WHERE appId = ?', bind: [appId] });
};

const getSyncTime = (appId: string): string | null => {
  let result: string | null = null;
  db.exec({
    sql: 'SELECT lastSyncAt FROM sync_metadata WHERE appId = ?',
    bind: [appId],
    rowMode: 'object',
    callback: (row: any) => {
      result = row.lastSyncAt;
    },
  });
  return result;
};

const setSyncTime = (appId: string, timestamp: string) => {
  db.exec({
    sql: 'INSERT OR REPLACE INTO sync_metadata (appId, lastSyncAt) VALUES (?, ?)',
    bind: [appId, timestamp],
  });
};

// ============ 消息处理 ============

onmessage = async (event) => {
  const { type, id, sql, params, appId, items, timestamp } = event.data;

  if (type === 'INIT') {
    await initDb();
    return;
  }

  if (!db) {
    postMessage({ type: 'ERROR', id, error: 'Database not initialized' });
    return;
  }

  try {
    switch (type) {
      // 通用 SQL 操作
      case 'EXEC':
        db.exec({ sql, bind: params });
        postMessage({ type: 'SUCCESS', id });
        break;

      case 'QUERY':
        const queryResults: any[] = [];
        db.exec({
          sql,
          bind: params,
          rowMode: 'object',
          callback: (row: any) => {
            queryResults.push(row);
          },
        });
        postMessage({ type: 'SUCCESS', id, results: queryResults });
        break;

      // 资源缓存操作
      case 'RESOURCES_GET_ALL':
        const resources = getAllResources(appId);
        postMessage({ type: 'SUCCESS', id, data: resources });
        break;

      case 'RESOURCES_UPSERT_BATCH':
        upsertResourcesBatch(appId, items);
        postMessage({ type: 'SUCCESS', id });
        break;

      case 'RESOURCES_CLEAR_APP':
        clearAppResources(appId);
        postMessage({ type: 'SUCCESS', id });
        break;

      case 'RESOURCES_GET_SYNC_TIME':
        const syncTime = getSyncTime(appId);
        postMessage({ type: 'SUCCESS', id, data: syncTime });
        break;

      case 'RESOURCES_SET_SYNC_TIME':
        setSyncTime(appId, timestamp);
        postMessage({ type: 'SUCCESS', id });
        break;

      default:
        postMessage({ type: 'ERROR', id, error: `Unknown message type: ${type}` });
    }
  } catch (error: any) {
    console.error(`[LocalDB] Error during ${type}:`, error);
    postMessage({ type: 'ERROR', id, error: error.message });
  }
};
```

### 2. 更新 ResourceCache.ts

只需修改消息类型名称：

```typescript
// 替换所有消息类型
'GET_ALL' → 'RESOURCES_GET_ALL'
'UPSERT_BATCH' → 'RESOURCES_UPSERT_BATCH'
'CLEAR_APP' → 'RESOURCES_CLEAR_APP'
'GET_SYNC_TIME' → 'RESOURCES_GET_SYNC_TIME'
'SET_SYNC_TIME' → 'RESOURCES_SET_SYNC_TIME'

// Worker 引用
new Worker(new URL('../local-db/LocalDatabaseWorker.ts', import.meta.url), {
  type: 'module',
})
```

## 优势

✅ **统一管理**: 所有本地数据在一个数据库中
✅ **易于扩展**: 添加新表非常简单
✅ **跨表事务**: 可以实现跨模块的原子操作
✅ **资源共享**: 只有一个 SQLite 实例，减少内存占用
✅ **类型安全**: 保持 TypeScript 类型检查
✅ **向后兼容**: 保留原有的通用 SQL 接口

## 未来扩展示例

### 添加表单草稿功能

```typescript
// LocalDatabaseWorker.ts 中添加
case 'DRAFTS_SAVE':
  db.exec({
    sql: `INSERT OR REPLACE INTO form_drafts
          (id, formId, userId, data, updatedAt)
          VALUES (?, ?, ?, ?, ?)`,
    bind: [draftId, formId, userId, JSON.stringify(data), new Date().toISOString()],
  });
  break;
```

### 添加文档缓存

```typescript
case 'DOCS_CACHE':
  db.exec({
    sql: `INSERT OR REPLACE INTO document_cache
          (id, docId, content, cachedAt)
          VALUES (?, ?, ?, ?)`,
    bind: [id, docId, content, new Date().toISOString()],
  });
  break;
```

## 下一步

我可以帮您：

1. 立即实施这个重构方案
2. 测试迁移是否成功
3. 更新相关文档

您想我现在就开始重构吗？
