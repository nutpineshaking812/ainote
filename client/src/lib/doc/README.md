# Resource Cache 使用指南

## 快速开始

### 基本用法

```tsx
import { useResourceCache } from '@/lib/resource-cache';

function AppDetailPage() {
  const appId = 'your-app-id';

  // 使用默认的 cache-first 模式
  const { resources, treeData, isLoading, isSyncing } = useResourceCache(appId);

  if (isLoading) {
    return <Spin />;
  }

  return (
    <div>
      {/* 使用树状数据 */}
      <Tree treeData={treeData} />

      {/* 或使用扁平数据 */}
      {resources.map((resource) => (
        <div key={resource.id}>{resource.meta.name}</div>
      ))}

      {/* 显示同步状态 */}
      {isSyncing && <Badge status="processing" text="同步中..." />}
    </div>
  );
}
```

## 三种获取模式

### 1. cache-first（默认推荐）

立即返回缓存数据，后台静默同步最新数据。

```tsx
const { resources, treeData } = useResourceCache(appId);
// 或显式指定
const { resources, treeData } = useResourceCache(appId, { mode: 'cache-first' });
```

**适用场景**：

- 应用详情页面（最常用）
- 需要快速首屏渲染
- 允许数据有短暂延迟

### 2. only-cache

仅从缓存读取，不发起网络请求。

```tsx
const { resources, treeData } = useResourceCache(appId, { mode: 'only-cache' });
```

**适用场景**：

- 离线模式
- 快速预览（已知数据在缓存中）
- 减少网络请求

### 3. only-network

仅从网络获取最新数据，并更新缓存。

```tsx
const { resources, treeData } = useResourceCache(appId, { mode: 'only-network' });
```

**适用场景**：

- 强制刷新
- 确保数据最新
- 调试或验证数据

## 手动操作

### 刷新数据

```tsx
function ResourceList() {
  const { resources, refresh, isSyncing } = useResourceCache(appId);

  const handleRefresh = async () => {
    try {
      await refresh();
      message.success('刷新成功');
    } catch (error) {
      message.error('刷新失败');
    }
  };

  return (
    <div>
      <Button onClick={handleRefresh} loading={isSyncing}>
        刷新
      </Button>
      <List dataSource={resources} />
    </div>
  );
}
```

### 清除缓存

```tsx
function SettingsPage() {
  const { clearCache } = useResourceCache(appId);

  const handleClearCache = async () => {
    await clearCache();
    message.success('缓存已清除');
  };

  return <Button onClick={handleClearCache}>清除缓存</Button>;
}
```

## 高级用法

### 监听同步状态

```tsx
function SyncIndicator() {
  const { isSyncing } = useResourceCache(appId);

  return (
    <Badge status={isSyncing ? 'processing' : 'success'} text={isSyncing ? '同步中' : '已同步'} />
  );
}
```

### 错误处理

```tsx
function ResourceView() {
  const { resources, error, refresh } = useResourceCache(appId);

  if (error) {
    return (
      <Alert
        type="error"
        message="加载失败"
        description={error.message}
        action={<Button onClick={refresh}>重试</Button>}
      />
    );
  }

  return <List dataSource={resources} />;
}
```

### 禁用自动加载

```tsx
function ConditionalLoad() {
  const [shouldLoad, setShouldLoad] = useState(false);

  // appId 为 null 时不会加载
  const { resources } = useResourceCache(shouldLoad ? appId : null);

  return (
    <div>
      <Button onClick={() => setShouldLoad(true)}>加载资源</Button>
      {resources.length > 0 && <List dataSource={resources} />}
    </div>
  );
}
```

## 数据结构

### ResourceItem（扁平数据）

```typescript
interface ResourceItem {
  id: string; // 资源 ID
  refId: string; // 引用 ID (form/view/document ID)
  type: 'form' | 'view' | 'document';
  parentId: string | null; // 父资源 ID
  order: number; // 排序
  hidden: boolean; // 是否隐藏
  pinned: boolean; // 是否置顶
  isLeaf: boolean; // 是否叶子节点
  updatedAt: string; // 更新时间
  meta: {
    name: string; // 名称
    desc?: string; // 描述
    icon?: string; // 图标
  };
}
```

### ResourceTreeNode（树状数据）

```typescript
interface ResourceTreeNode {
  key: string; // 唯一键："type-id"
  title: string; // 显示标题（meta.name）
  data: ResourceItem; // 完整资源数据
  isLeaf: boolean;
  children?: ResourceTreeNode[]; // 子节点
}
```

## 常见场景

### 1. 在资源树中使用

```tsx
import { Tree } from 'antd';
import { useResourceCache } from '@/lib/resource-cache';

function ResourceTree() {
  const { treeData, isLoading } = useResourceCache(appId);

  return <Tree treeData={treeData} loadData={onLoadData} onSelect={onSelect} />;
}
```

### 2. 结合路由参数

```tsx
import { useParams } from 'react-router-dom';

function AppDetail() {
  const { appId } = useParams();
  const { resources, isLoading } = useResourceCache(appId || null);

  if (!appId) return <div>请选择应用</div>;
  if (isLoading) return <Spin />;

  return <ResourceList resources={resources} />;
}
```

### 3. 多个应用同时缓存

```tsx
function MultiAppView() {
  const app1 = useResourceCache(appId1);
  const app2 = useResourceCache(appId2);

  return (
    <div>
      <Panel title="应用 1" resources={app1.resources} />
      <Panel title="应用 2" resources={app2.resources} />
    </div>
  );
}
```

## 性能提示

1. **默认使用 cache-first**：首屏渲染更快
2. **树状数据自动缓存**：`useMemo` 优化，仅在数据变化时重建
3. **订阅机制**：多个组件使用同一 `appId` 会共享缓存和订阅
4. **自动清理**：组件卸载时自动取消订阅，无内存泄漏

## 调试

### 查看缓存数据

```javascript
// 在浏览器控制台
import { resourceCache } from '@/lib/resource-cache';

// 查看缓存
const cached = await resourceCache.getFromCache('app-id');
console.table(cached);
```

### 强制同步

```javascript
// 强制从服务器获取最新数据
await resourceCache.syncFromNetwork('app-id');
```

### 清除所有缓存

```javascript
await resourceCache.clearApp('app-id');
```

## 常见问题

**Q: 数据多久同步一次？**  
A: 每次组件挂载时触发一次后台同步（cache-first 模式）

**Q: 离线时能用吗？**  
A: 可以，使用 `only-cache` 模式或依赖 cache-first 的缓存数据

**Q: 如何确保数据最新？**  
A: 使用 `only-network` 模式或调用 `refresh()` 方法

**Q: 缓存多大？**  
A: 每个应用约 100KB，根据资源数量变化

**Q: 支持哪些浏览器？**  
A: 现代浏览器（Chrome、Firefox、Safari、Edge）。不支持的浏览器会降级到内存缓存。

## 相关文档

- [可靠性分析](./RELIABILITY.md)
- [测试指南](./TESTING.md)
- [设计文档](../../../../../../.gemini/antigravity/brain/2e0f3c05-6d3f-4299-88bf-bbba076ebfc2/implementation_plan.md)
