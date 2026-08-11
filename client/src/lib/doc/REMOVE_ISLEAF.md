# 移除 isLeaf 字段

## 改进原因

`isLeaf` 是一个**派生字段**，可以由前端根据节点是否有子节点动态计算，无需存储。

### 问题

**之前的设计：**

```typescript
// 后端计算并返回
{
  id: '123',
  parentId: null,
  isLeaf: true,  // ← 后端需要查询子节点来确定
  ...
}

// 前端存储
CREATE TABLE resources (
  ...
  isLeaf INTEGER,  // ← 占用存储空间
  ...
);
```

**问题点：**

1. ❌ 后端需要额外计算（查询每个节点是否有子节点）
2. ❌ 前端存储冗余数据
3. ❌ 数据可能不一致（如果子节点动态增删）

## 解决方案

**移除 isLeaf 字段，前端动态计算：**

```typescript
// 后端返回时不包含 isLeaf
{
  id: '123',
  parentId: null,
  // 没有 isLeaf 字段
  ...
}

// 前端构建树时动态计算
const buildNode = (resource: ResourceItem) => {
  const children = childrenMap.get(resource.id) || [];
  const hasChildren = children.length > 0;

  return {
    ...resource,
    isLeaf: !hasChildren,  // 动态计算
    children: hasChildren ? children.map(buildNode) : undefined,
  };
};
```

## 修改内容

### 1. TypeScript 类型定义

**Before:**

```typescript
export interface ResourceItem {
  id: string;
  ...
  isLeaf: boolean;  // ← 移除
  meta: ResourceMeta;
}
```

**After:**

```typescript
export interface ResourceItem {
  id: string;
  ...
  // isLeaf 已移除
  meta: ResourceMeta;
}
```

### 2. 数据库表结构

**Before:**

```sql
CREATE TABLE resources (
  ...
  isLeaf INTEGER,
  ...
);
```

**After:**

```sql
CREATE TABLE resources (
  ...
  -- 已移除 isLeaf 列
  ...
);
```

### 3. Tree Builder

**Before:**

```typescript
const buildNode = (resource: ResourceItem) => {
  const children = childrenMap.get(resource.id) || [];

  return {
    ...
    isLeaf: resource.isLeaf,  // 使用存储的值
    children: children.length > 0 ? children.map(buildNode) : undefined,
  };
};
```

**After:**

```typescript
const buildNode = (resource: ResourceItem) => {
  const children = childrenMap.get(resource.id) || [];
  const hasChildren = children.length > 0;

  return {
    ...
    isLeaf: !hasChildren,  // 动态计算
    children: hasChildren ? children.map(buildNode) : undefined,
  };
};
```

## 优势

### 1. 简化后端逻辑

**Before（后端需要计算）：**

```javascript
// 后端需要为每个资源查询子节点
const resources = await AppResources.find({ appId });
for (const resource of resources) {
  const childrenCount = await AppResources.countDocuments({
    appId,
    parentId: resource.id,
  });
  resource.isLeaf = childrenCount === 0;
}
```

**After（后端无需处理）：**

```javascript
// 直接返回资源，不需要计算 isLeaf
const resources = await AppResources.find({ appId });
return resources;
```

### 2. 数据一致性

```typescript
// ❌ 之前：如果子节点被删除，isLeaf 可能过时
// 资源 A 有子节点 B
{ id: 'A', isLeaf: false }  // 正确

// B 被删除后
{ id: 'A', isLeaf: false }  // 错误！应该是 true

// ✅ 现在：始终准确
const children = childrenMap.get('A') || [];  // []
const isLeaf = !children.length;  // true，始终准确
```

### 3. 减少存储

- 少一个数据库列
- 少一个字段的传输
- 少一个字段的序列化/反序列化

### 4. 性能

```
Before:
  后端计算 isLeaf（N 次查询）→ 传输 → 前端存储 → 前端读取

After:
  后端直接返回 → 传输 → 前端计算（O(1)）
```

前端计算是 O(1) 操作（直接查 hashmap），比后端 N 次数据库查询高效。

## 兼容性

### 后端 API 响应

**需要修改：** 移除 `isLeaf` 字段

```javascript
// Before
{
  id: '123',
  type: 'form',
  isLeaf: true,  // ← 移除此字段
  meta: { name: '表单' }
}

// After
{
  id: '123',
  type: 'form',
  meta: { name: '表单' }
}
```

### 前端使用

**ResourceTreeNode 接口保持不变：**

```typescript
export interface ResourceTreeNode {
  key: string;
  title: string;
  data: ResourceItem;
  isLeaf: boolean; // ← 仍然存在，但是动态计算的
  children?: ResourceTreeNode[];
}
```

组件使用 `ResourceTreeNode` 时无需修改，`isLeaf` 仍然可用。

## 实施清单

- [x] 从 `ResourceItem` 类型中移除 `isLeaf`
- [x] 从数据库表中移除 `isLeaf` 列
- [x] 从 Repository 的 insert/update 逻辑中移除 `isLeaf`
- [x] 更新 `treeBuilder` 动态计算 `isLeaf`
- [ ] 后端移除 `isLeaf` 计算逻辑（需要后端配合）
- [ ] 后端 API 响应移除 `isLeaf` 字段（需要后端配合）

## 总结

✅ **简化后端** - 无需计算 isLeaf
✅ **减少存储** - 少一个数据库列
✅ **数据一致** - 始终准确，无过期风险
✅ **前端灵活** - 动态计算，适应变化
✅ **性能提升** - 减少后端查询和数据传输
