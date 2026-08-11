# addChildResource 数据库操作

## 改动内容

为 `addChildResource` 添加了数据库持久化操作。

## 实现

### ResourceCache.addChildResource

```typescript
/**
 * Add child resource to cache
 * @param appId Application ID
 * @param resource Resource to add
 */
public async addChildResource(appId: string, resource: ResourceItem): Promise<void> {
  // Use upsertBatch to add single resource
  await this.sendMessage(MSG_RESOURCES_UPSERT_BATCH, {
    appId,
    items: [resource],
    syncTimestamp: new Date().toISOString(),
  });

  // Get updated cache and notify subscribers
  const allResources = await this.getFromCache(appId);
  this.notifySubscribers(appId, allResources);
  console.log(`[ResourceCache] Added resource ${resource.id} to app ${appId}`);
}
```

### useResourceCache.addChildResource

```typescript
const addChildResource = useCallback(
  async (parentId: string | null, resource: ResourceItem) => {
    if (!appId) return;

    try {
      await resourceCache.addChildResource(appId, resource);
      // Resources will be updated via subscribe callback
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error('[useResourceCache] Add failed:', error);
      throw error;
    }
  },
  [appId],
);
```

## 数据流

```
useResourceCache.addChildResource(parentId, resource)
  ↓
ResourceCache.addChildResource(appId, resource)
  ↓
sendMessage(MSG_RESOURCES_UPSERT_BATCH, { appId, items: [resource] })
  ↓
LocalDatabaseWorker: MSG_RESOURCES_UPSERT_BATCH handler
  ↓
ResourcesRepository.upsertBatch(appId, [resource], syncTimestamp)
  ↓
SQLite: INSERT OR REPLACE INTO resources (...)
  ↓
Worker: postMessage({ type: MSG_SUCCESS })
  ↓
ResourceCache.getFromCache(appId)
  ↓
ResourceCache.notifySubscribers(appId, allResources)
  ↓
useResourceCache subscribe callback
  ↓
setResources([...prev, newResource]) → UI 更新
```

## 复用现有逻辑

`addChildResource` 复用了现有的 `upsertBatch` 方法：

```typescript
// 只需要传入单个资源的数组
await this.sendMessage(MSG_RESOURCES_UPSERT_BATCH, {
  appId,
  items: [resource], // ← 单个资源包装成数组
  syncTimestamp: new Date().toISOString(),
});
```

这样的好处：

- ✅ 不需要新的 Worker 消息类型
- ✅ 不需要新的 Repository 方法
- ✅ 复用现有的事务逻辑
- ✅ 代码简洁

## 使用示例

```typescript
const { addChildResource } = useResourceCache(appId);

// 在根节点添加新文档
await addChildResource(null, {
  id: 'new-doc-123',
  refId: 'doc-ref-123',
  type: 'document',
  parentId: null,
  order: 1,
  hidden: false,
  pinned: false,
  updatedAt: new Date().toISOString(),
  meta: { name: '新文档', desc: '' },
});

// 在指定文档下添加表单
await addChildResource('parent-doc-456', {
  id: 'new-form-789',
  refId: 'form-ref-789',
  type: 'form',
  parentId: 'parent-doc-456',
  order: 2,
  hidden: false,
  pinned: false,
  updatedAt: new Date().toISOString(),
  meta: { name: '新表单', desc: '' },
});
```

## 完整 CRUD 总结

现在所有 CRUD 操作都已完成数据库持久化：

| 操作       | hook 方法          | ResourceCache 方法 | 数据库操作             |
| ---------- | ------------------ | ------------------ | ---------------------- |
| **Create** | `addChildResource` | `addChildResource` | `upsertBatch` (INSERT) |
| **Read**   | `resources`        | `getFromCache`     | `SELECT`               |
| **Update** | `updateResource`   | `updateResource`   | `UPDATE`               |
| **Delete** | `deleteResource`   | `deleteResource`   | `DELETE`               |

### 数据流一致性

所有操作都遵循相同的模式：

```
1. Hook 调用 ResourceCache 方法
2. ResourceCache 发送消息到 Worker
3. Worker 调用 Repository 方法
4. Repository 执行 SQLite 操作
5. Worker 返回成功
6. ResourceCache 刷新缓存
7. ResourceCache 通知所有订阅者
8. Hook 通过 subscribe 回调更新 state
9. UI 自动更新
```

### 优势

✅ **统一接口**：所有操作通过 ResourceCache
✅ **自动通知**：所有操作自动更新 UI
✅ **数据持久化**：所有操作写入 SQLite
✅ **离线可用**：本地数据库支持离线操作
✅ **事务安全**：Repository 层使用事务

## 注意事项

### parentId 参数

虽然 `addChildResource` 接受 `parentId` 参数，但实际上这个信息已经包含在 `resource` 对象中：

```typescript
const addChildResource = async (parentId: string | null, resource: ResourceItem) => {
  // resource.parentId 应该与 parentId 一致
  await resourceCache.addChildResource(appId, resource);
};
```

**建议**：确保调用时 `resource.parentId` 与 `parentId` 参数一致，或者只使用 `resource.parentId`。

### ID 生成

添加资源前需要生成唯一 ID：

```typescript
import { v4 as uuidv4 } from 'uuid';

const newResource: ResourceItem = {
  id: uuidv4(), // ← 生成唯一 ID
  refId: generateRefId(), // ← 生成引用 ID
  type: 'document',
  parentId: selectedParentId,
  order: calculateNextOrder(), // ← 计算排序
  hidden: false,
  pinned: false,
  updatedAt: new Date().toISOString(),
  meta: { name: '新文档', desc: '' },
};

await addChildResource(selectedParentId, newResource);
```

## 完成！

现在所有 CRUD 操作都已完整实现：

- ✅ Create - `addChildResource` (写入数据库)
- ✅ Read - `resources` (从数据库读取)
- ✅ Update - `updateResource` (更新数据库)
- ✅ Delete - `deleteResource` (从数据库删除)

🎉 资源缓存系统功能完整！
