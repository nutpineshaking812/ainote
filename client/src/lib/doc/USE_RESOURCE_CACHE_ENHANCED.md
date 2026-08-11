# useResourceCache 增强功能

## 新增功能

### 1. `refresh` 支持 parentId 参数

刷新特定父节点下的资源，而不是全量刷新。

**签名：**

```typescript
refresh: (parentId?: string) => Promise<void>;
```

**使用示例：**

```typescript
const { refresh } = useResourceCache(appId);

// 全量刷新
await refresh();

// 只刷新根节点下的资源
await refresh(null);

// 只刷新特定父节点下的资源
await refresh('parent-123');
```

**应用场景：**

- 用户在某个文件夹下添加了新文档，只刷新该文件夹
- 减少不必要的数据传输和更新

---

### 2. `getExpandedKeys` - 获取展开路径

根据资源 ID 获取从根节点到该资源的所有展开键（用于树组件自动展开）。

**签名：**

```typescript
getExpandedKeys: (resourceId: string) => string[]
```

**使用示例：**

```typescript
const { getExpandedKeys } = useResourceCache(appId);

// 获取某个资源的展开路径
const keys = getExpandedKeys('resource-123');
// 返回: ['document-root', 'document-parent', 'form-resource-123']

// 用于 Ant Design Tree 组件
<Tree
  treeData={treeData}
  expandedKeys={getExpandedKeys(selectedResourceId)}
/>
```

**应用场景：**

- 打开页面时自动展开并定位到当前资源
- 从搜索结果跳转到资源并展开其父级路径
- 保持树的展开状态

**实现逻辑：**

```typescript
// 从当前节点向上遍历父节点
resource-123 → parent-456 → root
// 返回所有节点的 key（type-id 格式）
['document-root', 'document-parent-456', 'form-resource-123']
```

---

### 3. `updateResource` - 更新资源

根据 ID 更新资源的字段。

**签名：**

```typescript
updateResource: (id: string, updates: Partial<ResourceItem>) => Promise<void>;
```

**使用示例：**

```typescript
const { updateResource } = useResourceCache(appId);

// 更新资源名称
await updateResource('resource-123', {
  meta: { name: '新名称', desc: '新描述' },
});

// 更新隐藏状态
await updateResource('resource-123', {
  hidden: true,
});

// 更新排序
await updateResource('resource-123', {
  order: 5,
});
```

**应用场景：**

- 重命名表单/文档
- 设置隐藏/置顶
- 拖拽调整顺序

**注意：**

- 当前只更新本地状态
- TODO 注释标记了需要调用后端 API 的位置
- 实际项目中需要补充后端调用逻辑

---

### 4. `deleteResource` - 删除资源

根据 ID 删除资源。

**签名：**

```typescript
deleteResource: (id: string) => Promise<void>;
```

**使用示例：**

```typescript
const { deleteResource } = useResourceCache(appId);

// 删除资源
await deleteResource('resource-123');

// 带确认的删除
const handleDelete = async (id: string) => {
  if (confirm('确认删除？')) {
    try {
      await deleteResource(id);
      message.success('删除成功');
    } catch (err) {
      message.error('删除失败');
    }
  }
};
```

**应用场景：**

- 删除表单/文档
- 批量删除（循环调用）

**注意：**

- 只删除本地缓存中的记录
- TODO 需要调用后端 API 持久化

---

### 5. `addChildResource` - 添加子资源

在指定父节点下添加新资源。

**签名：**

```typescript
addChildResource: (parentId: string | null, resource: ResourceItem) => Promise<void>;
```

**使用示例：**

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

// 在指定文档下添加子文档
await addChildResource('parent-doc-456', {
  id: 'new-child-doc-789',
  refId: 'doc-ref-789',
  type: 'document',
  parentId: 'parent-doc-456',
  order: 1,
  hidden: false,
  pinned: false,
  updatedAt: new Date().toISOString(),
  meta: { name: '子文档', desc: '' },
});

// 在文档下添加表单
await addChildResource('parent-doc-456', {
  id: 'new-form-999',
  refId: 'form-ref-999',
  type: 'form',
  parentId: 'parent-doc-456',
  order: 2,
  hidden: false,
  pinned: false,
  updatedAt: new Date().toISOString(),
  meta: { name: '表单', desc: '' },
});
```

**应用场景：**

- 创建新表单/文档
- 在文档下添加子资源

**注意：**

- parentId 为 null 表示添加到根节点
- 当前只更新本地状态
- TODO 需要调用后端 API 持久化

---

## 完整使用示例

```typescript
import { useResourceCache } from '@/lib/resource-cache/hooks/useResourceCache';

function ResourceTreePanel({ appId }) {
  const {
    resources,
    treeData,
    isLoading,
    isSyncing,
    error,
    refresh,
    clearCache,
    getExpandedKeys,
    updateResource,
    deleteResource,
    addChildResource,
  } = useResourceCache(appId);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 1. 全量刷新
  const handleRefreshAll = async () => {
    await refresh();
  };

  // 2. 刷新特定节点
  const handleRefreshNode = async (nodeId: string) => {
    await refresh(nodeId);
  };

  // 3. 选中资源并自动展开
  const handleSelectResource = (resourceId: string) => {
    setSelectedId(resourceId);
    const keys = getExpandedKeys(resourceId);
    setExpandedKeys(keys);
  };

  // 4. 重命名
  const handleRename = async (id: string, newName: string) => {
    const resource = resources.find(r => r.id === id);
    if (resource) {
      await updateResource(id, {
        meta: { ...resource.meta, name: newName }
      });
    }
  };

  // 5. 删除
  const handleDelete = async (id: string) => {
    if (confirm('确认删除？')) {
      await deleteResource(id);
    }
  };

  // 6. 添加子节点
  const handleAddChild = async (parentId: string | null) => {
    const newResource: ResourceItem = {
      id: generateId(),
      refId: generateRefId(),
      type: 'document',
      parentId,
      order: 999,
      hidden: false,
      pinned: false,
      updatedAt: new Date().toISOString(),
      meta: { name: '新文档', desc: '' },
    };

    await addChildResource(parentId, newResource);
  };

  if (isLoading) return <Spin />;
  if (error) return <Alert type="error" message={error.message} />;

  return (
    <div>
      <Button onClick={handleRefreshAll} loading={isSyncing}>
        刷新全部
      </Button>

      <Tree
        treeData={treeData}
        selectedKeys={selectedId ? [selectedId] : []}
        expandedKeys={selectedId ? getExpandedKeys(selectedId) : []}
        onSelect={([key]) => handleSelectResource(key as string)}
      />

      {/* 右键菜单 */}
      <ContextMenu
        items={[
          { label: '重命名', onClick: () => handleRename(selectedId, '新名称') },
          { label: '删除', onClick: () => handleDelete(selectedId) },
          { label: '添加子节点', onClick: () => handleAddChild(selectedId) },
          { label: '刷新此节点', onClick: () => handleRefreshNode(selectedId) },
        ]}
      />
    </div>
  );
}
```

---

## TODO 清单

以下功能标记为 TODO，需要补充后端 API 调用：

### `updateResource`

```typescript
// TODO: Call backend API to persist changes
// await api.put(`/apps/${appId}/resources/${id}`, updates);
```

### `deleteResource`

```typescript
// TODO: Call backend API to persist deletion
// await api.delete(`/apps/${appId}/resources/${id}`);
```

### `addChildResource`

```typescript
// TODO: Call backend API to persist addition
// await api.post(`/apps/${appId}/resources`, { ...resource, parentId });
```

**实施建议：**

1. 创建 `api/resources.ts` 文件定义这些 API
2. 在 CRUD 方法中调用 API
3. 成功后更新本地状态，失败则回滚

---

## 性能考虑

### `getExpandedKeys`

- **复杂度**: O(depth) - 树的深度
- **优化**: 已使用 Map 加速查找，从 O(n) 降至 O(1)
- **缓存**: 使用 `useCallback` + `resources` 依赖，避免重复计算

### `refresh` 局部刷新

```typescript
// 只更新特定父节点的子资源
if (parentId !== undefined) {
  setResources((prev) => {
    const filtered = prev.filter((r) => r.parentId !== parentId);
    const newChildren = freshResources.filter((r) => r.parentId === parentId);
    return [...filtered, ...newChildren];
  });
}
```

**优势**：

- 减少不必要的状态更新
- 减少网络传输（如果后端支持）
- 减少重渲染

---

## 总结

| 功能                 | 用途           | 状态          |
| -------------------- | -------------- | ------------- |
| `refresh(parentId?)` | 全量或局部刷新 | ✅ 已实现     |
| `getExpandedKeys`    | 获取展开路径   | ✅ 已实现     |
| `updateResource`     | 更新资源       | ⚠️ 需后端 API |
| `deleteResource`     | 删除资源       | ⚠️ 需后端 API |
| `addChildResource`   | 添加子资源     | ⚠️ 需后端 API |

这些增强功能让 `useResourceCache` 成为一个**全功能的资源管理 Hook**，支持查询、更新、删除、添加等完整的 CRUD 操作！🎉
