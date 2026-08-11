import { eq, and, ne, inArray, sql, desc, or, ilike, lt, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { documents } from '../db/schema/index.js';
import { mapResponse } from '../db/utils.js';
import { createBaseRepository } from './base.repository.js';

/**
 * Document Repository
 * Encapsulates all PostgreSQL interactions for the documents table.
 */
export const DocumentRepository = {
  table: documents,
  ...createBaseRepository(documents),

  /**
   * Build the access query for documents based on user roles and departments.
   */
  getAccessQuery(userId, context = {}) {
    const { roleIds = [], departmentIds = [] } = context;

    return or(
      eq(documents.createdBy, userId),
      sql`${documents.shares} @> '[{"targetType": "ALL"}]'::jsonb`,
      sql`${documents.shares} @> ${JSON.stringify([{ targetType: 'USER', targetId: userId }])}::jsonb`,
      roleIds.length > 0
        ? or(...roleIds.map(rid => sql`${documents.shares} @> ${JSON.stringify([{ targetType: 'ROLE', targetId: rid }])}::jsonb`))
        : sql`false`,
      departmentIds.length > 0
        ? or(...departmentIds.map(did => sql`${documents.shares} @> ${JSON.stringify([{ targetType: 'DEPARTMENT', targetId: did }])}::jsonb`))
        : sql`false`
    );
  },

  /**
   * Find documents with access control and pagination.
   */
  async findWithAccess(options) {
    const { conditions = [], limit = 20, offset = 0, orderBy = [desc(documents.updatedAt)] } = options;
    const drizzle = await import('drizzle-orm');

    // Resolve function-style conditions (t, d) => expression
    const resolvedConditions = conditions.map(c =>
      typeof c === 'function' ? c(documents, drizzle) : c
    );
    
    const countResult = await db
      .select({ count: sql`count(*)` })
      .from(documents)
      .where(and(...resolvedConditions));
    
    const total = parseInt(countResult[0].count);

    const results = await db.query.documents.findMany({
      where: and(...resolvedConditions),
      orderBy,
      limit,
      offset,
    });

    return {
      items: mapResponse(results),
      total,
    };
  },

  /**
   * Find recent documents for a user with access check and optional organization filter.
   */
  async findRecent(options) {
    const { userId, appIds, limit = 6, lastId = null, query = null } = options;
    
    const accessFilter = or(
      eq(documents.createdBy, userId),
      sql`${documents.shares} @> ${JSON.stringify([{ targetType: 'USER', targetId: userId }])}::jsonb`
    );
    
    const conditions = [accessFilter];

    if (appIds && appIds.length > 0) {
      conditions.push(inArray(documents.appRef, appIds));
    } else if (appIds) {
      // appIds provided but empty -> no access
      return { items: [], hasMore: false };
    }

    if (query && query.trim()) {
      conditions.push(or(
        ilike(documents.title, `%${query.trim()}%`), 
        ilike(documents.contentPlain, `%${query.trim()}%`)
      ));
    }

    if (lastId) {
      const lastDoc = await db.query.documents.findFirst({ where: eq(documents.id, lastId) });
      if (lastDoc) {
        conditions.push(or(
          lt(documents.updatedAt, lastDoc.updatedAt), 
          and(eq(documents.updatedAt, lastDoc.updatedAt), lt(documents.id, lastDoc.id))
        ));
      }
    }

    const results = await db.query.documents.findMany({
      where: and(...conditions),
      orderBy: [desc(documents.updatedAt), desc(documents.id)],
      limit: limit + 1,
    });

    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;

    return {
      items: mapResponse(items),
      hasMore,
    };
  },

  /**
   * Find titles for a list of document IDs.
   */
  async findTitlesByIds(ids) {
    if (!ids || ids.length === 0) return [];
    return await db
      .select({ id: documents.id, title: documents.title })
      .from(documents)
      .where(inArray(documents.id, ids));
  },

  /**
   * Filter a list of document IDs against user access permissions.
   */
  async findAccessibleIds(docIds, userId, context) {
    if (!docIds || docIds.length === 0) return [];
    const accessFilter = this.getAccessQuery(userId, context);
    const results = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(inArray(documents.id, docIds.map(id => id.toString())), accessFilter));
    return results.map(doc => doc.id);
  },

  /**
   * Find documents by a list of IDs.
   */
  async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    return await db.select().from(documents).where(inArray(documents.id, ids));
  },

  /**
   * Find document IDs by creator.
   */
  async findIdsByCreator(userId) {
    const results = await db
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.createdBy, userId.toString()));
    return results.map(r => r.id);
  },

  /**
   * Find documents by purpose (SKILL / KNOWLEDGE) with access control.
   * Used by deep-agent to fetch accessible documents for skill/knowledge listing.
   */
  async findByPurpose({ userId, appId, purpose, docIds, context }) {
    const accessFilter = this.getAccessQuery(userId, context);

    return await this.findAll({
      where: (t, d) => {
        const conds = [accessFilter];
        if (purpose) {
          conds.push(d.eq(t.purpose, purpose));
        } else {
          conds.push(d.ne(t.docType, 'ai_memory'));
        }
        if (appId) {
          conds.push(d.eq(t.appRef, appId.toString()));
        }
        if (docIds) {
          const cleanIds = docIds.map((id) =>
            id.startsWith('doc:') ? id.substring(4) : id,
          );
          if (cleanIds.length > 0) {
            conds.push(d.inArray(t.id, cleanIds));
          } else {
            conds.push(d.eq(t.id, ''));
          }
        }
        return d.and(...conds);
      },
    });
  },

  /**
   * Find the AI memory document for a specific app.
   */
  async findMemoryByApp(appId) {
    return await this.findAll({
      where: (t, d) =>
        d.and(d.eq(t.appRef, appId.toString()), d.eq(t.docType, 'ai_memory')),
    });
  },

  /**
   * Full-text search on content_plain using PostgreSQL regex.
   * Returns doc IDs with matching snippets.
   */
  async grepContentPlain(docIds, pattern, limit = 20) {
    if (!docIds || docIds.length === 0) return [];
    return await db
      .select({
        id: documents.id,
        snippet: sql`substring(${documents.contentPlain} from ${pattern})`.mapWith(String),
      })
      .from(documents)
      .where(
        and(
          inArray(documents.id, docIds),
          sql`${documents.contentPlain} ~ ${pattern}`,
        ),
      )
      .limit(limit)
      .execute();
  },

  /**
   * Match document names against a PostgreSQL regex on title and skill_name.
   * Returns matching docs with id, title, skillName.
   */
  async matchNameRegex(docIds, nameRegex) {
    if (!docIds || docIds.length === 0) return [];
    return await db
      .select({
        id: documents.id,
        title: documents.title,
        skillName: documents.skillName,
      })
      .from(documents)
      .where(
        and(
          inArray(documents.id, docIds),
          sql`(${documents.title} ~ ${nameRegex} OR ${documents.skillName} ~ ${nameRegex})`,
        ),
      )
      .execute();
  },

  /**
   * Find a document and its immediate children in one SQL query using JSON aggregation.
   */
  async findWithChildren(docId) {
    // Use raw SQL with JSON aggregation for high performance
    // Note: raw SQL returns snake_case column names, so we explicitly alias
    // the camelCase fields that the service layer expects.
    const results = await db.execute(sql`
      SELECT 
        d.id,
        d.id as "_id",
        d.doc_type as "docType",
        d.app_ref as "appRef",
        d.title,
        d.blocks,
        d.content_plain as "contentPlain",
        d.attachments,
        d.original_file_id as "originalFileId",
        d.tags,
        d.purpose,
        d.skill_name as "skillName",
        d.description,
        d.parameters,
        d.created_by as "createdBy",
        d.updated_by as "updatedBy",
        d.shares,
        d.created_at as "createdAt",
        d.updated_at as "updatedAt",
        (
          SELECT json_agg(row_to_json(children_data))
          FROM (
            SELECT 
              rc.ref_id as "_id", 
              rc.meta->>'name' as "title", 
              rc.type
            FROM lc.app_resources rs
            JOIN lc.app_resources rc ON rc.parent_id = rs.id
            WHERE rs.ref_id = ${docId} 
              AND rs.type = 'document'
              AND rc.deleted = false
            ORDER BY rc."order" ASC
          ) children_data
        ) as children
      FROM lc.documents d
      WHERE d.id = ${docId}
    `);

    if (!results.rows || results.rows.length === 0) return null;
    
    const row = results.rows[0];
    return {
      doc: mapResponse([row])[0],
      children: row.children || []
    };
  },

  /**
   * [DatabaseBackend] 轻量级文档列表查询（仅返回 id / title / skillName / description）
   * 专为 ls('/') / grep / glob 设计，不拉取 blocks 字段，减少网络传输与内存开销。
   * 权限过滤由调用方传入 accessFilter（由 getAccessQuery 生成）。
   */
  async findMetadataByApp(appId, accessFilter, docIds) {
    const conditions = [
      accessFilter,
      ne(documents.docType, 'ai_memory'),
    ];
    if (appId) conditions.push(eq(documents.appRef, appId.toString()));
    if (docIds && docIds.length > 0) {
      const cleanIds = docIds.map((id) =>
        typeof id === 'string' && id.startsWith('doc:') ? id.substring(4) : String(id),
      );
      conditions.push(inArray(documents.id, cleanIds));
    }
    return db
      .select({
        id: documents.id,
        title: documents.title,
        skillName: documents.skillName,
        description: documents.description,
      })
      .from(documents)
      .where(and(...conditions))
      .orderBy(asc(documents.updatedAt));
  },

  /**
   * [DatabaseBackend] 按 skillName 或 title 精确查找单篇文档（含 blocks）
   * 专为 read('/<name>/SKILL.md') / write 存在性检查设计。
   * 优先匹配 skillName，再匹配 title（均为 exact 匹配）。
   * 权限过滤由调用方传入 accessFilter。
   */
  async findOneBySkillName(appId, name, accessFilter) {
    const rows = await db
      .select()
      .from(documents)
      .where(
        and(
          accessFilter,
          eq(documents.appRef, appId.toString()),
          ne(documents.docType, 'ai_memory'),
          or(
            eq(documents.skillName, name),
            eq(documents.title, name),
          ),
        ),
      )
      .limit(1);
    return rows.length > 0 ? mapResponse(rows)[0] : null;
  },

  /**
   * [DatabaseBackend] 按 ID 列表批量拉取完整文档（含 blocks）
   * 专为 downloadFiles 并行批读优化设计，避免每条路径独立调用 findByPurpose。
   */
  async findFullByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const cleanIds = ids.map((id) =>
      typeof id === 'string' && id.startsWith('doc:') ? id.substring(4) : String(id),
    );
    return mapResponse(
      await db.select().from(documents).where(inArray(documents.id, cleanIds)),
    );
  },
};


export default DocumentRepository;
