# Meta 字段存储优化

## 改进内容

将 `meta` 对象从多个列（`metaName`, `metaDesc`, `metaIcon`）简化为单个 JSON 列（`metaJson`）。

## 修改前后对比

### Before（分列存储）

```sql
CREATE TABLE resources (
  ...
  metaName TEXT,
  metaDesc TEXT,
  metaIcon TEXT,
  ...
);
```

```typescript
// 插入
stmt.bind([
  ...,
  item.meta.name,
  item.meta.desc || '',
  item.meta.icon || null,
  ...
]);

// 查询
meta: {
  name: row.metaName || '未命名',
  desc: row.metaDesc || '',
  icon: row.metaIcon,
}
```

### After（JSON 存储）

```sql
CREATE TABLE resources (
  ...
  metaJson TEXT,  -- 存储整个 meta 对象的 JSON 字符串
  ...
);
```

```typescript
// 插入
stmt.bind([
  ...,
  JSON.stringify(item.meta),
  ...
]);

// 查询
let meta = { name: '未命名', desc: '', icon: undefined };
try {
  if (row.metaJson) {
    meta = JSON.parse(row.metaJson);
  }
} catch (error) {
  console.error('Failed to parse metaJson:', error);
}
```

## 优势

### 1. 灵活性

```typescript
// ✅ 可以随时添加新字段，无需修改表结构
meta: {
  name: '表单名',
  desc: '描述',
  icon: 'form',
  color: '#1890ff',      // 新增字段
  creator: 'user123',    // 新增字段
  tags: ['important']    // 新增字段
}
```

### 2. 简化代码

```typescript
// ❌ 之前：需要手动展开每个字段
(item.meta.name,
  item.meta.desc || '',
  item.meta.icon || null,
  // ✅ 现在：一行搞定
  JSON.stringify(item.meta));
```

### 3. 减少列数

- 3 列 → 1 列
- 更清爽的表结构
- 更少的索引维护

### 4. 与后端一致

后端 MongoDB 存储的 `meta` 本身就是对象，前端存储为 JSON 字符串保持一致。

## 潜在问题和解决

### 问题 1：无法按 meta 字段查询

**问题**：

```sql
-- ❌ 无法这样查询
SELECT * FROM resources WHERE metaName = '我的表单';
```

**解决**：

1. 如果需要按 meta 字段查询，使用应用层过滤：

```typescript
const resources = repo.getAll(appId);
const filtered = resources.filter((r) => r.meta.name === '我的表单');
```

2. 或者使用 SQLite 的 JSON 函数（需要 SQLite 3.38+）：

```sql
SELECT * FROM resources
WHERE json_extract(metaJson, '$.name') = '我的表单';
```

### 问题 2：JSON 解析失败

**解决**：已添加 try-catch 错误处理

```typescript
try {
  if (row.metaJson) {
    meta = JSON.parse(row.metaJson);
  }
} catch (error) {
  console.error('[ResourcesRepository] Failed to parse metaJson:', error);
  // 使用默认值
  meta = { name: '未命名', desc: '', icon: undefined };
}
```

### 问题 3：类型安全

**解决**：TypeScript 接口保持不变

```typescript
// types.ts - 接口定义不变
export interface ResourceMeta {
  name: string;
  desc?: string;
  icon?: string;
}

export interface ResourceItem {
  ...
  meta: ResourceMeta;  // 类型安全
}
```

## 数据迁移

如果已有旧数据（使用 `metaName` 等列），需要迁移：

```typescript
// 迁移脚本（可选）
migrateMeta() {
  this.db.exec('BEGIN TRANSACTION');

  try {
    // 1. 添加新列
    this.db.exec('ALTER TABLE resources ADD COLUMN metaJson TEXT');

    // 2. 迁移数据
    this.db.exec(`
      UPDATE resources
      SET metaJson = json_object(
        'name', COALESCE(metaName, '未命名'),
        'desc', COALESCE(metaDesc, ''),
        'icon', metaIcon
      )
    `);

    // 3. 删除旧列（可选）
    // SQLite 不支持直接删除列，需要重建表

    this.db.exec('COMMIT');
  } catch (error) {
    this.db.exec('ROLLBACK');
    throw error;
  }
}
```

**注意**：本项目是新实现，不存在旧数据，无需迁移。下次用户打开应用时会自动创建新表结构。

## 未来扩展

### 支持任意 meta 字段

```typescript
// 后端可以返回任意字段
{
  id: '123',
  meta: {
    name: '表单',
    desc: '描述',
    icon: 'form',
    color: '#1890ff',
    customField1: 'value1',
    customField2: { nested: 'value' }
  }
}

// 前端自动存储和还原，无需修改代码
await repo.upsertBatch(appId, items);
const restored = repo.getAll(appId);
// restored[0].meta.customField1 === 'value1' ✅
```

### 搜索功能

如果需要搜索 meta 内容，可以：

1. **应用层过滤**（小数据集）：

```typescript
const results = resources.filter(
  (r) => r.meta.name.includes(keyword) || r.meta.desc?.includes(keyword),
);
```

2. **全文搜索表**（大数据集）：

```sql
CREATE VIRTUAL TABLE resources_fts USING fts5(
  id, name, desc, content='resources'
);

-- 触发器同步更新
CREATE TRIGGER resources_fts_insert AFTER INSERT ON resources
BEGIN
  INSERT INTO resources_fts(id, name, desc)
  SELECT id,
         json_extract(metaJson, '$.name'),
         json_extract(metaJson, '$.desc')
  FROM resources WHERE id = NEW.id;
END;
```

## 总结

✅ **灵活性**：支持任意 meta 字段
✅ **简洁性**：减少列数，代码更简洁
✅ **一致性**：与后端 MongoDB 存储一致
✅ **类型安全**：TypeScript 接口不变
✅ **错误处理**：JSON 解析失败有降级
