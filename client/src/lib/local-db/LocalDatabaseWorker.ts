import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { ResourcesRepository } from './repositories/ResourcesRepository';
import {
  MSG_INIT,
  MSG_INIT_SUCCESS,
  MSG_INIT_ERROR,
  MSG_SUCCESS,
  MSG_ERROR,
  MSG_EXEC,
  MSG_QUERY,
  MSG_RESOURCES_GET_ALL,
  MSG_RESOURCES_UPSERT_BATCH,
  MSG_RESOURCES_CLEAR_APP,
  MSG_RESOURCES_GET_SYNC_TIME,
  MSG_RESOURCES_UPDATE,
  MSG_RESOURCES_DELETE,
  MSG_RESOURCES_DELETE_BATCH,
} from './messageTypes';

let db: any = null;
let resourcesRepo: ResourcesRepository | null = null;

/**
 * 初始化数据库
 */
const initDb = async () => {
  try {
    // @ts-ignore
    const sqlite3 = await sqlite3InitModule({
      locateFile: (path: string, prefix: string) => {
        const base = self.location.origin;
        const cleanPath = path.replace(/^assets\//, '');
        const resolved = new URL('assets/' + cleanPath, base).href;
        console.log('[LocalDB] locateFile: path =', path, 'prefix =', prefix, 'base =', base, '-> resolved =', resolved);
        return resolved;
      }
    });
    console.log('[LocalDB] SQLite3 initialized');

    // Try to use OPFS for persistence, fallback to in-memory
    if ('opfs' in sqlite3) {
      try {
        db = new sqlite3.oo1.OpfsDb('/local.db');
        console.log('[LocalDB] OPFS database opened');
      } catch (opfsError) {
        console.warn('[LocalDB] OPFS database failed to open, falling back to in-memory:', opfsError);
        db = new sqlite3.oo1.DB('/local.db', 'ct');
        console.log('[LocalDB] In-memory database opened (OPFS fallback)');
      }
    } else {
      db = new sqlite3.oo1.DB('/local.db', 'ct');
      console.log('[LocalDB] In-memory database opened');
    }

    // 初始化 repositories
    resourcesRepo = new ResourcesRepository(db);
    resourcesRepo.initTable();

    // 未来的 repositories
    // formDraftsRepo = new FormDraftsRepository(db);
    // formDraftsRepo.initTable();

    console.log('[LocalDB] All repositories initialized');
    postMessage({ type: MSG_INIT_SUCCESS });
  } catch (error: any) {
    console.error('[LocalDB] Failed to initialize:', error);
    postMessage({ type: MSG_INIT_ERROR, error: error.message });
  }
};

/**
 * 消息处理器
 */
onmessage = async (event) => {
  const { type, id, sql, params, appId, items, syncTimestamp } = event.data;

  // 初始化
  if (type === MSG_INIT) {
    await initDb();
    return;
  }

  // 检查数据库是否已初始化
  if (!db) {
    postMessage({ type: MSG_ERROR, id, error: 'Database not initialized' });
    return;
  }

  try {
    switch (type) {
      // ========== 通用 SQL 操作 ==========
      case MSG_EXEC:
        db.exec({ sql, bind: params });
        postMessage({ type: MSG_SUCCESS, id });
        break;

      case MSG_QUERY:
        const queryResults: any[] = [];
        db.exec({
          sql,
          bind: params,
          rowMode: 'object',
          callback: (row: any) => {
            queryResults.push(row);
          },
        });
        postMessage({ type: MSG_SUCCESS, id, results: queryResults });
        break;

      // ========== 资源缓存操作 ==========
      case MSG_RESOURCES_GET_ALL:
        if (!resourcesRepo) throw new Error('ResourcesRepository not initialized');
        const resources = resourcesRepo.getAll(appId);
        postMessage({ type: MSG_SUCCESS, id, data: resources });
        break;

      case MSG_RESOURCES_UPSERT_BATCH:
        if (!resourcesRepo) throw new Error('ResourcesRepository not initialized');
        resourcesRepo.upsertBatch(appId, items, syncTimestamp);
        postMessage({ type: MSG_SUCCESS, id });
        break;

      case MSG_RESOURCES_CLEAR_APP:
        if (!resourcesRepo) throw new Error('ResourcesRepository not initialized');
        resourcesRepo.clearApp(appId);
        postMessage({ type: MSG_SUCCESS, id });
        break;

      case MSG_RESOURCES_GET_SYNC_TIME:
        if (!resourcesRepo) throw new Error('ResourcesRepository not initialized');
        const syncTime = resourcesRepo.getLastSyncTime(appId);
        postMessage({ type: MSG_SUCCESS, id, data: syncTime });
        break;

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

      case MSG_RESOURCES_DELETE_BATCH:
        if (!resourcesRepo) throw new Error('ResourcesRepository not initialized');
        resourcesRepo.deleteBatch(appId, event.data.ids);
        postMessage({ type: MSG_SUCCESS, id });
        break;

      // ========== 未来扩展 ==========
      // case 'DRAFTS_SAVE':
      //   formDraftsRepo.save(draftId, formId, userId, data);
      //   break;

      default:
        postMessage({ type: MSG_ERROR, id, error: `Unknown message type: ${type}` });
    }
  } catch (error: any) {
    console.error(`[LocalDB] Error during ${type}:`, error);
    postMessage({ type: MSG_ERROR, id, error: error.message });
  }
};
