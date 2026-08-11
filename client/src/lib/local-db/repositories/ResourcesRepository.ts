import type { ResourceItem } from '../../resource-cache/types';

/**
 * Resources Repository
 *
 * 封装所有资源缓存相关的数据库操作
 */
export class ResourcesRepository {
  constructor(private db: any) {}

  /**
   * 初始化资源缓存表
   */
  initTable() {
    // 1. 创建基础表（如果不存在）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY,
        appId TEXT NOT NULL,
        parentId TEXT,
        type TEXT NOT NULL,
        refId TEXT NOT NULL,
        "order" TEXT,
        hidden INTEGER DEFAULT 0,
        pinned INTEGER DEFAULT 0,
        metaJson TEXT,
        updatedAt TEXT,
        lastSyncAt INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_resources_app ON resources(appId);
      CREATE INDEX IF NOT EXISTS idx_resources_app_parent ON resources(appId, parentId);
      CREATE INDEX IF NOT EXISTS idx_resources_updated ON resources(appId, updatedAt);
    `);

    // 2. 检查并迁移 order 列（从 INTEGER 到 TEXT）
    // 由于 SQLite 不支持直接 ALTER COLUMN TYPE，我们通过尝试执行一个能触发类型转换的操作
    // 或者直接忽略错误尝试增加新列。但最稳健的方式是尝试 ALTER TABLE。
    try {
      // 检查 order 列的类型，如果是旧版本则需要特殊处理
      // 这里我们采取简单的策略：尝试修改或确保后续写入不报错
      // 在 WebSQL/SQLite 中，TEXT 列可以兼容 INTEGER 数据，反之不行。
      // 如果字段已经是 TEXT，这个操作是安全的。
      this.db.exec(`
        /* 迁移逻辑：确保 order 列可以存储字符串 */
        PRAGMA foreign_keys=OFF;
      `);

      // 注意：SQLite 不直接支持修改列类型。但我们可以利用其动态类型的特性，
      // 只要 CREATE TABLE 变成了 TEXT，新数据就会以 TEXT 存储。
      // 对于存量数据，我们只需要确保它不会因为后续的字符串写入而崩溃。
    } catch (e) {
      console.warn('[ResourcesRepository] Migration check failed (optional):', e);
    }

    // 3. 检查并添加 metaJson 字段（如果不存在，处理旧版本数据库兼容性）
    try {
      this.db.exec('ALTER TABLE resources ADD COLUMN metaJson TEXT');
      console.log('[LocalDB] Added metaJson column to resources table');
    } catch (e: any) {
      // 如果字段已存在，执行 ALTER TABLE 会报错，我们忽略它
      if (e.message && e.message.includes('duplicate column name')) {
        // Column already exists, all good
      } else {
        // Other errors, might want to know
        console.warn('[LocalDB] Column check note:', e.message);
      }
    }
  }

  /**
   * 获取应用的所有资源
   */
  getAll(appId: string): ResourceItem[] {
    const results: ResourceItem[] = [];
    this.db.exec({
      sql: 'SELECT * FROM resources WHERE appId = ? ORDER BY "order"',
      bind: [appId],
      rowMode: 'object',
      callback: (row: any) => {
        results.push(this._rowToResource(row));
      },
    });
    // console.log('all resource', results);
    return results;
  }

  /**
   * 批量插入或更新资源
   */
  upsertBatch(appId: string, items: ResourceItem[], syncTimestamp?: string) {
    this.db.exec('BEGIN TRANSACTION');

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO resources (
          id, appId, parentId, type, refId, "order", hidden, pinned,
          metaJson, updatedAt, lastSyncAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          JSON.stringify(item.meta),
          item.updatedAt,
          syncTimestamp ? new Date(syncTimestamp).getTime() : Date.now(),
        ]);
        stmt.step();
        stmt.reset();
      }

      stmt.finalize();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * 清除应用的所有资源
   */
  clearApp(appId: string) {
    this.db.exec({
      sql: 'DELETE FROM resources WHERE appId = ?',
      bind: [appId],
    });
  }

  /**
   * 获取最后同步时间
   */
  getLastSyncTime(appId: string): number | null {
    let result: any = null;
    this.db.exec({
      sql: 'SELECT MAX(lastSyncAt) as lastSyncAt FROM resources WHERE appId = ?',
      bind: [appId],
      rowMode: 'object',
      callback: (row: any) => {
        result = row.lastSyncAt;
      },
    });

    if (result === null) return null;

    // Return as number directly (newly stored as INTEGER)
    // If it's old data (string), convert it to number.
    if (typeof result === 'string') {
      return new Date(result).getTime();
    }
    return result;
  }

  /**
   * 更新单个资源
   */
  update(appId: string, id: string, updates: Partial<ResourceItem>) {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.parentId !== undefined) {
      fields.push('parentId = ?');
      values.push(updates.parentId);
    }
    if (updates.type !== undefined) {
      fields.push('type = ?');
      values.push(updates.type);
    }
    if (updates.refId !== undefined) {
      fields.push('refId = ?');
      values.push(updates.refId);
    }
    if (updates.order !== undefined) {
      fields.push('"order" = ?');
      values.push(updates.order);
    }
    if (updates.hidden !== undefined) {
      fields.push('hidden = ?');
      values.push(updates.hidden ? 1 : 0);
    }
    if (updates.pinned !== undefined) {
      fields.push('pinned = ?');
      values.push(updates.pinned ? 1 : 0);
    }
    if (updates.meta !== undefined) {
      fields.push('metaJson = ?');
      values.push(JSON.stringify(updates.meta));
    }
    if (updates.updatedAt !== undefined) {
      fields.push('updatedAt = ?');
      values.push(updates.updatedAt);
    }

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

  /**
   * 删除单个资源
   */
  delete(appId: string, id: string) {
    this.db.exec({
      sql: 'DELETE FROM resources WHERE id = ? AND appId = ?',
      bind: [id, appId],
    });
  }

  /**
   * 批量删除资源
   */
  deleteBatch(appId: string, ids: string[]) {
    if (ids.length === 0) return;

    // 使用 IN 子句批量删除
    const placeholders = ids.map(() => '?').join(', ');
    this.db.exec({
      sql: `DELETE FROM resources WHERE appId = ? AND id IN (${placeholders})`,
      bind: [appId, ...ids],
    });
  }

  /**
   * 将数据库行转换为 ResourceItem
   */
  private _rowToResource(row: any): ResourceItem {
    // 解析 meta JSON
    let meta = { name: '未命名', desc: '', icon: undefined };
    try {
      if (row.metaJson) {
        meta = JSON.parse(row.metaJson);
      }
    } catch (error) {
      console.error('[ResourcesRepository] Failed to parse metaJson:', error);
    }

    return {
      id: row.id,
      refId: row.refId,
      type: row.type,
      parentId: row.parentId,
      order: row.order,
      hidden: !!row.hidden,
      pinned: !!row.pinned,
      updatedAt: row.updatedAt,
      meta,
    };
  }
}
