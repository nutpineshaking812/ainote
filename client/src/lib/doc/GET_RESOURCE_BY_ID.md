# getResourceById 方法

## 功能

在 `useResourceCache` hook 中添加了 `getResourceById` 方法，用于根据 ID 快速查找资源。

## 接口定义

```typescript
export interface UseResourceCacheResult {
  // ... 其他属性

  /** Get resource by id */
  getResourceById: (resourceId: string) => ResourceItem | undefined;

  // ... 其他方法
}
```

## 实现

```typescript
const getResourceById = useCallback(
  (resourceId: string): ResourceItem | undefined => {
    return resources.find((r) => r.id === resourceId);
  },
  [resources],
);
```

## 特点

✅ **缓存友好**：使用 `useCallback` 包装，依赖 `resources`
✅ **O(n) 复杂度**：线性查找，适合中小规模数据
✅ **类型安全**：返回 `ResourceItem | undefined`
✅ **简洁明了**：单行实现，易于理解

## 使用示例

### 基础用法

```typescript
const { getResourceById } = useResourceCache(appId);

// 根据 ID 查找资源
const resource = getResourceById('resource-123');

if (resource) {
  console.log('找到资源:', resource.meta.name);
} else {
  console.log('资源不存在');
}
```

### 在组件中使用

```typescript
function ResourceDetail({ resourceId }: { resourceId: string }) {
  const { getResourceById, isLoading } = useResourceCache(appId);

  if (isLoading) return <Spin />;

  const resource = getResourceById(resourceId);

  if (!resource) {
    return <Empty description="资源不存在" />;
  }

  return (
    <div>
      <h1>{resource.meta.name}</h1>
      <p>{resource.meta.desc}</p>
      <p>类型: {resource.type}</p>
      <p>更新时间: {new Date(resource.updatedAt).toLocaleString()}</p>
    </div>
  );
}
```

### 与其他方法配合使用

```typescript
function ResourceActions({ resourceId }: { resourceId: string }) {
  const {
    getResourceById,
    updateResource,
    deleteResource,
    getExpandedKeys,
  } = useResourceCache(appId);

  const resource = getResourceById(resourceId);
  if (!resource) return null;

  const handleRename = async () => {
    const newName = prompt('新名称:', resource.meta.name);
    if (newName) {
      await updateResource(resourceId, {
        meta: { ...resource.meta, name: newName },
      });
    }
  };

  const handleToggleHidden = async () => {
    await updateResource(resourceId, {
      hidden: !resource.hidden,
    });
  };

  const handleDelete = async () => {
    if (confirm(`确认删除 "${resource.meta.name}"?`)) {
      await deleteResource(resourceId);
    }
  };

  const handleLocate = () => {
    const keys = getExpandedKeys(resourceId);
    console.log('展开路径:', keys);
    // 展开树到此资源
  };

  return (
    <Space>
      <Button onClick={handleRename}>重命名</Button>
      <Button onClick={handleToggleHidden}>
        {resource.hidden ? '显示' : '隐藏'}
      </Button>
      <Button onClick={handleLocate}>定位</Button>
      <Button danger onClick={handleDelete}>删除</Button>
    </Space>
  );
}
```

### URL 参数场景

```typescript
function ResourcePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getResourceById, isLoading } = useResourceCache(appId);

  useEffect(() => {
    if (!isLoading && id) {
      const resource = getResourceById(id);
      if (!resource) {
        // 资源不存在，重定向
        message.error('资源不存在');
        navigate('/');
      }
    }
  }, [id, isLoading, getResourceById, navigate]);

  const resource = getResourceById(id);

  if (isLoading) return <Spin />;
  if (!resource) return null;

  return <ResourceDetail resource={resource} />;
}
```

### 面包屑导航

```typescript
function Breadcrumb({ resourceId }: { resourceId: string }) {
  const { getResourceById } = useResourceCache(appId);

  // 构建面包屑路径
  const buildPath = (id: string): ResourceItem[] => {
    const path: ResourceItem[] = [];
    let current = getResourceById(id);

    while (current) {
      path.unshift(current);
      if (!current.parentId) break;
      current = getResourceById(current.parentId);
    }

    return path;
  };

  const path = buildPath(resourceId);

  return (
    <AntBreadcrumb>
      <AntBreadcrumb.Item>
        <HomeOutlined />
      </AntBreadcrumb.Item>
      {path.map((resource) => (
        <AntBreadcrumb.Item key={resource.id}>
          {resource.meta.name}
        </AntBreadcrumb.Item>
      ))}
    </AntBreadcrumb>
  );
}
```

## 性能考虑

### 当前实现

```typescript
return resources.find((r) => r.id === resourceId);
```

- **复杂度**: O(n)
- **适用场景**: 中小规模数据（< 1000 条）
- **优点**: 简单、直接从最新数据查找

### 如果需要优化（大数据量）

可以创建一个 Map 缓存：

```typescript
const resourceMap = useMemo(() => {
  return new Map(resources.map((r) => [r.id, r]));
}, [resources]);

const getResourceById = useCallback(
  (resourceId: string): ResourceItem | undefined => {
    return resourceMap.get(resourceId);
  },
  [resourceMap],
);
```

- **复杂度**: O(1)
- **额外内存**: O(n)
- **适用场景**: 大数据量（> 1000 条）且频繁查询

**当前实现足够**，因为：

1. 资源树通常不会特别大（几百条）
2. `find` 在现代 JS 引擎中很快
3. 代码更简洁，易维护

## 与 getExpandedKeys 的区别

| 方法              | 返回值                      | 用途                     |
| ----------------- | --------------------------- | ------------------------ |
| `getResourceById` | `ResourceItem \| undefined` | 获取单个资源             |
| `getExpandedKeys` | `string[]`                  | 获取从根到资源的展开路径 |

**配合使用示例：**

```typescript
const resource = getResourceById('resource-123');
if (resource) {
  // 获取资源详情
  console.log(resource.meta.name);

  // 获取展开路径
  const keys = getExpandedKeys(resource.id);
  setExpandedKeys(keys);
}
```

## 完整方法列表

现在 `useResourceCache` 提供的所有方法：

| 方法               | 参数                 | 返回值                      | 说明             |
| ------------------ | -------------------- | --------------------------- | ---------------- |
| `getResourceById`  | `id`                 | `ResourceItem \| undefined` | 根据 ID 获取资源 |
| `getExpandedKeys`  | `id`                 | `string[]`                  | 获取展开路径     |
| `updateResource`   | `id, updates`        | `Promise<void>`             | 更新资源         |
| `deleteResource`   | `id`                 | `Promise<void>`             | 删除资源         |
| `addChildResource` | `parentId, resource` | `Promise<void>`             | 添加资源         |
| `refresh`          | `parentId?`          | `Promise<void>`             | 刷新数据         |
| `clearCache`       | -                    | `Promise<void>`             | 清空缓存         |

## 总结

✅ **简单实用**：单行实现，易于理解
✅ **类型安全**：明确的返回类型
✅ **性能足够**：对于常见规模的数据完全够用
✅ **易于扩展**：如需要可轻松优化为 Map 查找

这个方法让根据 ID 访问资源变得更加便捷！🎉
