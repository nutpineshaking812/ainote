# 字段对比：前端表 vs 后端接口

## 对比表格

| 字段         | 后端接口 (getResourcesSync) | 前端表 (ResourcesRepository) | 是否一致 | 说明                     |
| ------------ | --------------------------- | ---------------------------- | -------- | ------------------------ |
| `id`         | ✅ 返回                     | ✅ 存储                      | ✅       | 资源ID（主键）           |
| `appId`      | ❌ 未返回（查询条件）       | ✅ 存储                      | ⚠️       | 应用ID                   |
| `refId`      | ✅ 返回                     | ✅ 存储                      | ✅       | 引用ID                   |
| `type`       | ✅ 返回                     | ✅ 存储                      | ✅       | 资源类型                 |
| `parentId`   | ✅ 返回                     | ✅ 存储                      | ✅       | 父节点ID                 |
| `order`      | ✅ 返回                     | ✅ 存储                      | ✅       | 排序                     |
| `hidden`     | ✅ 返回                     | ✅ 存储                      | ✅       | 是否隐藏                 |
| `pinned`     | ✅ 返回                     | ✅ 存储                      | ✅       | 是否置顶                 |
| `updatedAt`  | ✅ 返回                     | ✅ 存储                      | ✅       | 更新时间                 |
| `meta`       | ✅ 返回（对象）             | ✅ 存储（JSON字符串）        | ✅       | 元数据                   |
| `lastSyncAt` | ❌ 未返回                   | ✅ 存储                      | ⚠️       | 最后同步时间（前端管理） |
| `rawData`    | ❌ 未返回                   | ✅ 存储                      | ⚠️       | 完整原始数据（调试用）   |

## 详细分析

### ✅ 一致的字段（9个）

所有业务字段都一致，前端可以正确存储和还原后端数据。

### ⚠️ 差异字段（3个）

#### 1. `appId`

- **后端**：作为查询条件传入，不返回在 response 中
- **前端**：需要存储以便查询时过滤
- **影响**：需要在存储时手动添加

```typescript
// ResourcesRepository.ts - upsertBatch
stmt.bind([
  item.id,
  appId,  // ← 手动传入，不是从 item 中取
  item.parentId,
  ...
]);
```

#### 2. `lastSyncAt`

- **后端**：返回 `timestamp` 字段表示同步时间
- **前端**：存储在每条记录的 `lastSyncAt` 字段
- **影响**：用于增量同步判断

```typescript
// 同步时传入
resourcesRepo.upsertBatch(appId, items, syncTimestamp);
```

#### 3. `rawData`

- **后端**：不返回
- **前端**：存储完整原始数据（`JSON.stringify(item)`）
- **影响**：仅用于调试，实际未使用

```typescript
// 调试时可以查看完整数据
SELECT rawData FROM resources WHERE id = '123';
```

## 推荐调整

### 选项 1：后端返回 appId（推荐）

**理由**：

- 数据完整性
- 前端不需要手动管理 appId
- 与其他字段保持一致

**修改**：

```javascript
// resource.service.js
const items = resources.map((resource) => ({
  id: resource._id.toString(),
  appId: resource.appId.toString(),  // ← 添加
  refId: resource.refId,
  ...
}));
```

**前端受益**：

```typescript
// 不需要额外传 appId
stmt.bind([
  item.id,
  item.appId,  // ← 直接从 item 中取
  item.parentId,
  ...
]);
```

### 选项 2：前端计算 appId（当前实现）

**理由**：

- 减少数据传输（虽然只是几个字节）
- appId 在同一次请求中都相同，没必要重复传输

**保持现状即可**。

## 字段映射代码

### 后端返回

```javascript
{
  id: "507f1f77bcf86cd799439011",
  refId: "form-001",
  type: "form",
  parentId: null,
  order: 1,
  hidden: false,
  pinned: true,
  updatedAt: "2024-01-01T00:00:00.000Z",
  meta: {
    name: "我的表单",
    desc: "这是描述",
    icon: "form"
  }
}
```

### 前端存储

```sql
INSERT INTO resources (
  id, appId, parentId, type, refId, "order", hidden, pinned,
  metaJson, updatedAt, lastSyncAt, rawData
) VALUES (
  '507f1f77bcf86cd799439011',
  'app-123',  -- 手动添加
  null,
  'form',
  'form-001',
  1,
  0,
  1,
  '{"name":"我的表单","desc":"这是描述","icon":"form"}',
  '2024-01-01T00:00:00.000Z',
  '2024-01-01T00:00:00.000Z',  -- 同步时间
  '{...}'  -- 完整原始 JSON
);
```

## 总结

### 核心业务字段

✅ **完全一致**，前后端数据契约清晰

### 辅助字段

⚠️ **合理差异**：

- `appId` - 前端自己管理（已传入）
- `lastSyncAt` - 前端同步机制需要
- `rawData` - 前端调试需要

### 建议

**保持现状**，当前设计合理，不需要调整。

如果想要更严格的一致性，可以：

1. 后端返回 `appId`
2. 移除 `rawData`（如果不用于调试）

但这些都是**可选优化**，不影响功能正确性。
