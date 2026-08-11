# 数据库操作增强

## 改进内容

1. **refresh 支持 parentId 参数传递到后端**
2. **update/delete 操作同步到本地 SQLite 数据库**

## 1. refresh 支持 parentId 参数

### 前端改动

**ResourceCache.syncFromNetwork:**

```typescript
// Before
public async syncFromNetwork(appId: string): Promise<ResourceItem[]>

// After
public async syncFromNetwork(appId: string, parentId?: string): Promise<ResourceItem[]>
```

**URL 构建：**

```typescript
// 构建带 parentId 的 URL
let url = `/apps/${appId}/resources/sync`;
const params = new URLSearchParams();

if (lastSyncAt) {
  params.append('updatedAfter', lastSyncAt);
}
if (parentId !== undefined) {
  params.append('parentId', parentId || 'null');
}

// 示例 URL:
// /apps/123/resources/sync?updatedAfter=2024-01-01&parentId=null  (根节点)
// /apps/123/resources/sync?parentId=parent-456  (特定父节点)
```

**useResourceCache.refresh:**

```typescript
// 支持可选的 parentId 参数
const refresh = async (parentId?: string) => {
  await resourceCache.syncFromNetwork(appId, parentId);
  const allResources = await resourceCache.getFromCache(appId);
  setResources(allResources);
};

// 使用示例
await refresh(); // 全量同步
await refresh(null); // 只同步根节点
await refresh('parent-123'); // 只同步特定父节点下的子资源
```

### 后端需要支持

**resource.service.js 需要添加 parentId 过滤：**

```javascript
const getResourcesSync = async (appId, userId, updatedAfter = null, parentId = undefined) => {
  await accessService.ensureAppAccess(appId, userId);

  const query = {
    appId: new ObjectId(app Id),
  };

  // Delta sync
  if (updatedAfter) {
    query.updatedAt = { $gt: new Date(updatedAfter) };
  }

  // ParentId filter
  if (parentId !== undefined) {
    query.parentId = parentId === 'null' ? null : new ObjectId(parentId);
  }

  const resources = await AppResources.find(query).sort({ order: 1 }).lean();

  const items = resources.map((resource) => ({
    id: resource._id.toString(),
    refId: resource.refId,
    type: resource.type,
    parentId: resource.parentId ? resource.parentId.toString() : null,
    order: resource.order,
    hidden: resource.hidden,
    pinned: resource.pinned,
    updatedAt: resource.updatedAt,
    meta: resource.meta || {},
  }));

  return {
    items,
    timestamp: new Date().toISOString(),
  };
};
```

**Controller 修改：**

```javascript
// resource.controller.js
const getResourcesSync = async (req, res) => {
  const { appId } = req.params;
  const { updatedAfter, parentId } = req.query;

  const result = await resourceService.getResourcesSync(
    appId,
    req.user.userId,
    updatedAfter,
    parentId, // ← 传递 parentId
  );

  res.json(result);
};
```

---

## 2. update/delete 操作同步到数据库

### 新增文件

**messageTypes.ts:**

```typescript
export const MSG_RESOURCES_UPDATE = 'RESOURCES_UPDATE';
export const MSG_RESOURCES_DELETE = 'RESOURCES_DELETE';
export const MSG_RESOURCES_DELETE_BATCH = 'RESOURCES_DELETE_BATCH';
```

### 数据库层 (ResourcesRepository.ts)

**update 方法：**

```typescript
update(appId: string, id: string, updates: Partial<ResourceItem>) {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.parentId !== undefined) {
    fields.push('parentId = ?');
    values.push(updates.parentId);
  }
  // ... 其他字段

  if (fields.length === 0) return;

  // 总是更新 lastSyncAt
  fields.push('lastSyncAt = ?');
  values.push(new Date().toISOString());

  values.push(id, appId);

  this.db.exec({
    sql: `UPDATE resources SET ${fields.join(', ')} WHERE id = ? AND appId = ?`,
    bind: values,
  });
}
```

**delete 方法：**

```typescript
delete(appId: string, id: string) {
  this.db.exec({
    sql: 'DELETE FROM resources WHERE id = ? AND appId = ?',
    bind: [id, appId],
  });
}
```

### Worker 层 (LocalDatabaseWorker.ts)

```typescript
case MSG_RESOURCES_UPDATE:
  if (!resourcesRepo) throw new Error('ResourcesRepository not initialized');
  const { resourceId, updates } = event.data;
  resourcesRepo.update(appId, resourceId, updates);
  postMessage({ type: MSG_SUCCESS, id });
  break;

case MSG_RESOURCES_DELETE:
  if (!resourcesRepo) throw new Error('ResourcesRepository not initialized');
  resourcesRepo.delete(appId, event.data.resourceId);
  postMessage({ type: MSG_SUCCESS, id });
  break;
```

### 缓存层 (ResourceCache.ts)

```typescript
/**
 * Update resource in cache
 */
public async updateResource(
  appId: string,
  resourceId: string,
  updates: Partial<ResourceItem>,
): Promise<void> {
  await this.sendMessage(MSG_RESOURCES_UPDATE, { appId, resourceId, updates });

  // Get updated cache and notify subscribers
  const allResources = await this.getFromCache(appId);
  this.notifySubscribers(appId, allResources);
  console.log(`[ResourceCache] Updated resource ${resourceId} in app ${appId}`);
}

/**
 * Delete resource from cache
 */
public async deleteResource(appId: string, resourceId: string): Promise<void> {
  await this.sendMessage(MSG_RESOURCES_DELETE, { appId, resourceId });

  // Get updated cache and notify subscribers
  const allResources = await this.getFromCache(appId);
  this.notifySubscribers(appId, allResources);
  console.log(`[ResourceCache] Deleted resource ${resourceId} from app ${appId}`);
}
```

### Hook 层 (useResourceCache.ts)

```typescript
const updateResource = useCallback(
  async (id: string, updates: Partial<ResourceItem>) => {
    if (!appId) return;

    try {
      await resourceCache.updateResource(appId, id, updates);
      // Resources will be updated via subscribe callback (自动通知)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error('[useResourceCache] Update failed:', error);
      throw error;
    }
  },
  [appId],
);

const deleteResource = useCallback(
  async (id: string) => {
    if (!appId) return;

    try {
      await resourceCache.deleteResource(appId, id);
      // Resources will be updated via subscribe callback (自动通知)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error('[useResourceCache] Delete failed:', error);
      throw error;
    }
  },
  [appId],
);
```

## 完整数据流

### Update 操作流程

```
useResourceCache.updateResource(id, updates)
  ↓
ResourceCache.updateResource(appId, id, updates)
  ↓
localDb.sendMessage(MSG_RESOURCES_UPDATE, { appId, resourceId, updates })
  ↓
LocalDatabaseWorker: MSG_RESOURCES_UPDATE handler
  ↓
ResourcesRepository.update(appId, id, updates)
  ↓
SQLite: UPDATE resources SET ... WHERE id = ? AND appId = ?
  ↓
Worker: postMessage({ type: MSG_SUCCESS })
  ↓
ResourceCache: getFromCache(appId)
  ↓
ResourceCache.notifySubscribers(appId, allResources)
  ↓
useResourceCache subscribe callback
  ↓
setResources(updatedResources) → UI 更新
```

### Delete 操作流程

```
useResourceCache.deleteResource(id)
  ↓
ResourceCache.deleteResource(appId, id)
  ↓
localDb.sendMessage(MSG_RESOURCES_DELETE, { appId, resourceId })
  ↓
LocalDatabaseWorker: MSG_RESOURCES_DELETE handler
  ↓
ResourcesRepository.delete(appId, id)
  ↓
SQLite: DELETE FROM resources WHERE id = ? AND appId = ?
  ↓
Worker: postMessage({ type: MSG_SUCCESS })
  ↓
ResourceCache: getFromCache(appId)
  ↓
ResourceCache.notifySubscribers(appId, allResources)
  ↓
useResourceCache subscribe callback
  ↓
setResources(filteredResources) → UI 更新
```

## 使用示例

```typescript
const { resources, refresh, updateResource, deleteResource } = useResourceCache(appId);

// 1. 局部刷新
await refresh('parent-123'); // 后端需要支持

// 2. 更新资源（写入本地数据库）
await updateResource('resource-123', {
  meta: { name: '新名称' },
  hidden: true,
});

// 3. 删除资源（从本地数据库删除）
await deleteResource('resource-123');
```

## TODO

### 后端 API

需要添加 `parentId` 参数支持：

```javascript
router.get('/apps/:appId/resources/sync', protect, resourceController.getResourcesSync);
```

在 controller 中从 `req.query.parentId` 获取参数并传递给 service。

## 优势

### 1. 性能

- **局部刷新**：只同步需要的数据，减少网络传输
- **数据库操作**：update/delete 直接操作 SQLite，无需全量替换

### 2. 一致性

- **自动通知**：CRUD 操作后自动通知所有订阅者
- **单一数据源**：所有操作都通过 ResourceCache，确保一致性

### 3. 可扩展

- **统一接口**：所有数据库操作通过 Repository
- **消息类型**：易于添加新的数据库操作

## 总结

✅ **refresh** - 支持 parentId 参数，可局部同步
✅ **updateResource** - 写入本地SQLite数据库
✅ **deleteResource** - 从本地SQLite数据库删除
✅ **自动通知** - 所有操作自动更新 UI
✅ **单一数据源** - 通过 ResourceCache 统一管理

现在 CRUD 操作都持久化到本地数据库了！🎉
