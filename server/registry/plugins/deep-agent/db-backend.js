/**
 * DatabaseBackend — 将 deepagents Backend 协议映射到 PostgreSQL 文档数据库
 *
 * 协议方法（SandboxBackendProtocolV2）：
 *   ls(path)               → 查询 documents 表，返回虚拟目录列表
 *   read(filePath, o, l)   → 按 skillName/title 直接查找文档，转为带 frontmatter 的 Markdown
 *   write(filePath, data)  → 解析 frontmatter + markdown，upsert documents 表
 *   edit(filePath, o, n)   → read + 字符串替换 + write
 *   grep(pattern, path)    → PostgreSQL `~` 正则全文匹配 contentPlain
 *   glob(pattern, path)    → PostgreSQL 正则匹配文档 title/skillName
 *   uploadFiles(files)     → 串行逐个 write
 *   downloadFiles(paths)   → 并行 read（共享 accessFilterPromise 与 findMetadataByApp 结果）
 *   readRaw(filePath)      → 不支持二进制（返回错误友好说明）
 *   execute(command)       → 禁止（文档存储层不支持代码执行）
 *   id (getter)            → `db-backend-${appId}`
 *
 * 虚拟文件结构（严格限制 2 层深度）：
 *   /                      → 列出所有文档目录 + /agent.md
 *   /<doc-name>/           → 列出 SKILL.md
 *   /<doc-name>/SKILL.md   → 文档内容（frontmatter + markdown body）
 *   /agent.md              → 长期记忆（可读写）
 *
 * SQL 次数精确统计（已排除异步 event 触发）：
 *
 * 【核心优化】accessFilterPromise 在构造函数中立即初始化：
 *   实例创建时即发起 getUserContext 查询（2 SQL），所有方法共享同一个已解析的 Promise，
 *   整个 Backend 实例生命周期内额外 SQL 消耗为零。
 *
 *   ls('/')                  → 首次实例: 3 SQL | 复用实例: 1 SQL
 *   ls('/<name>') 命中       → 首次实例: 3 SQL | 复用实例: 1 SQL
 *   ls('/<name>') 兜底       → 首次实例: 4 SQL | 复用实例: 2 SQL
 *   read('/agent.md')        → 始终: 1 SQL
 *   read('/<name>/SKILL.md') → 首次实例: 3 SQL | 复用实例: 1 SQL
 *   write('/agent.md')       → 始终: 2 SQL
 *   write 更新已有文档        → 首次实例: 4 SQL | 复用实例: 2 SQL
 *   write 创建新文档          → 首次实例: ≈7 SQL | 复用实例: ≈5 SQL
 *   edit('/<name>/SKILL.md') → 首次实例: 4 SQL | 复用实例: 2 SQL
 *   grep(pattern)            → 首次实例: 4 SQL | 复用实例: 2 SQL
 *   glob(pattern)            → 首次实例: 4 SQL | 复用实例: 2 SQL
 *   uploadFiles(N)           → 首次实例触发 2 SQL，后续每文件 2~5 SQL
 *   downloadFiles(N)         → 首次实例: 3 SQL | 复用实例: 2 SQL (批量合并查询)
 */

import matter from 'gray-matter';
import DocumentRepository from '../../../repositories/document.repository.js';
import AIMemoryRepository from '../../../repositories/aiMemory.repository.js';
import documentService from '../../../services/document.service.js';
import {
  blocksToMarkdown,
  markdownToBlocks,
  markdownToPlain,
} from '../../../utils/contentProcessor.js';
import { safeName, getUserContext, SKILL_REF_REGEX } from './utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// 模块级辅助函数（无状态）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 规范化虚拟路径：合并多余斜杠，防止目录穿越，去掉尾斜杠
 */
function normalizePath(p) {
  if (!p || p === '/') return '/';
  let clean = p.replace(/\\/g, '/').replace(/\.\.+/g, '').replace(/\/+/g, '/');
  if (clean !== '/') clean = clean.replace(/\/$/, '');
  return clean || '/';
}

/**
 * 解析路径为结构体
 *   /                      → { isRoot: true }
 *   /agent.md              → { isRootFile: 'agent.md' }
 *   /<name>                → { docName: name }
 *   /<name>/SKILL.md       → { docName: name, fileName: 'SKILL.md', isSkillMd: true }
 *   3 层及以上             → { tooDeep: true }
 */
function parsePath(p) {
  const normalized = normalizePath(p);
  if (normalized === '/') return { isRoot: true };

  const parts = normalized.replace(/^\//, '').split('/');
  if (parts.length === 1) {
    const part = parts[0];
    if (part.includes('.')) return { isRootFile: part };
    return { docName: part };
  }
  if (parts.length === 2) {
    return { docName: parts[0], fileName: parts[1], isSkillMd: parts[1] === 'SKILL.md' };
  }
  return { tooDeep: true };
}

/**
 * 将 safeName 应用到轻量级元数据行（findMetadataByApp 返回，无 blocks）
 */
function metaSafeName(row) {
  const raw = row.skillName || row.title || `doc-${row.id}`;
  return raw.trim().replace(/[\\/:*?"<>|]/g, '-');
}

/**
 * 将完整文档记录（含 blocks）转换为带 frontmatter 的 Markdown
 */
async function docToMarkdown(doc, log) {
  const displayName = doc.skillName || doc.title || `doc-${doc.id}`;
  const description = doc.description || doc.title || '';

  log?.(`[DatabaseBackend] 构建 Markdown: ${displayName}`);

  const bodyContent = await blocksToMarkdown(doc.blocks || [], {
    serverRuntime: true,
    withImage: false,
  });

  const allowedTools = new Set();
  let refMatch;
  SKILL_REF_REGEX.lastIndex = 0;
  while ((refMatch = SKILL_REF_REGEX.exec(bodyContent)) !== null) {
    const type  = refMatch[1].trim();
    const refId = refMatch[2].trim();
    if (type === 'tool' || type === 'mcp') allowedTools.add(refId);
  }

  const lines = ['---', `name: ${displayName}`, `description: ${description}`];
  if (allowedTools.size > 0) {
    lines.push('allowed-tools:');
    for (const t of allowedTools) lines.push(`  - ${t}`);
  }
  lines.push('---', '');

  return lines.join('\n') + bodyContent;
}

/**
 * 将带 frontmatter 的 Markdown 解析为写入数据库的载荷
 * blocks 与 contentPlain 并行转换
 */
async function parseSkillMarkdown(content) {
  const parsed = matter(content);
  const meta   = parsed.data || {};
  const body   = parsed.content || '';

  const title       = meta.name || meta.title || 'Untitled';
  const skillName   = meta.name || null;
  const description = meta.description || meta.desc || null;

  const [blocks, contentPlain] = await Promise.all([
    markdownToBlocks(body),
    markdownToPlain(body),
  ]);

  return { title, skillName, description, blocks, contentPlain };
}

/**
 * 对文本按行应用 offset/limit 切片
 */
function applyOffsetLimit(content, offset = 0, limit) {
  if ((!offset || offset === 0) && (limit === undefined || limit === null)) return content;
  const lines = content.split('\n');
  const start = offset || 0;
  const end   = limit !== undefined && limit !== null ? start + limit : undefined;
  return lines.slice(start, end).join('\n');
}

/**
 * glob 模式匹配（用于 /agent.md 判断）
 */
function globMatches(pattern, target) {
  const rx = new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '\x01')
        .replace(/\*/g, '[^/]*')
        .replace(/\x01/g, '.*')
        .replace(/\?/g, '.') +
      '$',
  );
  return rx.test(target);
}

// ─────────────────────────────────────────────────────────────────────────────
// DatabaseBackend 类定义
// ─────────────────────────────────────────────────────────────────────────────

export class DatabaseBackend {
  /**
   * @param {object}   ctx
   * @param {string}   ctx.userId          操作用户 ID
   * @param {string}   ctx.appId           关联应用 ID
   * @param {object}   ctx.logger          日志上下文（提供 sendConsoleLog）
   * @param {string[]} ctx.allDocIds       当前会话已绑定的文档 ID 列表
   * @param {string}   ctx.sessionId       会话 ID（用于长期记忆读写）
   * @param {object}   ctx.sandboxBackend  关联的远程/本地沙箱后端实例，供执行代码时上传使用
   */
  constructor(ctx) {
    const { userId, appId, logger, allDocIds, sessionId, sandboxBackend } = ctx;
    this.userId         = userId;
    this.appId          = appId;
    this.allDocIds      = undefined;
    this.sessionId      = sessionId;
    this.sandboxBackend = sandboxBackend;
    this._log           = (msg) => logger?.sendConsoleLog?.(msg);

    /**
     * 访问控制 Filter — 构造时立即初始化，整个实例生命周期共享
     * getUserContext 只执行一次（2 SQL），所有方法 await 同一个 Promise，后续额外 SQL 为零
     */
    this.accessFilterPromise = getUserContext(userId, appId).then(
      (context) => DocumentRepository.getAccessQuery(userId, context),
    );
  }

  get id() {
    return `db-backend-${this.appId || 'global'}`;
  }

  // ─── 内部数据获取辅助 ───────────────────────────────────────────────────────

  /**
   * 内部拉取元数据列表（不含 blocks 字段，轻量且高效）
   * @returns {Promise<Array>}
   */
  async _fetchMetadata() {
    const accessFilter = await this.accessFilterPromise;
    return DocumentRepository.findMetadataByApp(this.appId, accessFilter, this.allDocIds);
  }

  /**
   * 精确或兜底按 docName 查找单篇文档（含 blocks）
   * @returns {Promise<object|null>}
   */
  async _fetchOneByName(docName) {
    const accessFilter = await this.accessFilterPromise;
    const direct = await DocumentRepository.findOneBySkillName(this.appId, docName, accessFilter);
    if (direct) return direct;

    const meta = await DocumentRepository.findMetadataByApp(this.appId, accessFilter, this.allDocIds);
    const hit  = meta.find((row) => metaSafeName(row) === docName);
    if (!hit) return null;

    const rows = await DocumentRepository.findFullByIds([hit.id]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 写入核心实现
   * 更新路径：跳过业务 service 的查询，直接调用 Repository.update (省 1 SQL)
   * 新建路径：调用 documentService.createGeneralDoc 处理组织资源归档等逻辑
   */
  async _writeDoc(existingDoc, payload, filePath) {
    if (existingDoc) {
      await DocumentRepository.update(String(existingDoc.id), {
        title:        payload.title,
        skillName:    payload.skillName || payload.title,
        description:  payload.description,
        blocks:       payload.blocks,
        contentPlain: payload.contentPlain,
        purpose:      'SKILL',
        updatedBy:    this.userId ? String(this.userId) : null,
        updatedAt:    new Date(),
      });
      this._log(`[DatabaseBackend] 技能文档已更新: ${payload.title} (id=${existingDoc.id})`);
    } else {
      await documentService.createGeneralDoc(
        this.appId,
        {
          title:       payload.title,
          skillName:   payload.skillName || payload.title,
          description: payload.description,
          blocks:      payload.blocks,
          purpose:     'SKILL',
          isResource:  true,
        },
        this.userId || 'system',
      );
      this._log(`[DatabaseBackend] 技能文档已创建: ${payload.title}`);
    }
    return { path: filePath };
  }

  // ─── 协议接口实现 ──────────────────────────────────────────────────────────

  /**
   * 列出目录内容
   * @param {string} dirPath 虚拟路径
   */
  async ls(dirPath) {
    try {
      const parsed = parsePath(dirPath);
      if (parsed.tooDeep) return { files: [] };

      // 根目录
      if (parsed.isRoot) {
        const meta  = await this._fetchMetadata();
        const files = meta.map((row) => ({ path: `/${metaSafeName(row)}`, is_dir: true }));
        if (this.sessionId) files.push({ path: '/agent.md', is_dir: false });
        return { files };
      }

      // 根级文件（/agent.md 等）
      if (parsed.isRootFile) {
        if (parsed.isRootFile === 'agent.md' && this.sessionId) {
          return { files: [{ path: '/agent.md', is_dir: false }] };
        }
        return { files: [] };
      }

      // 子目录 /<name>：判断文档是否存在
      if (parsed.docName && !parsed.fileName) {
        const accessFilter = await this.accessFilterPromise;
        const doc = await DocumentRepository.findOneBySkillName(this.appId, parsed.docName, accessFilter);
        let exists = !!doc;
        if (!exists) {
          const meta = await DocumentRepository.findMetadataByApp(this.appId, accessFilter, this.allDocIds);
          exists = meta.some((row) => metaSafeName(row) === parsed.docName);
        }
        if (!exists) return { files: [] };
        return { files: [{ path: `/${parsed.docName}/SKILL.md`, is_dir: false }] };
      }

      return { files: [] };
    } catch (err) {
      return { error: `ls 失败: ${err.message}` };
    }
  }

  /**
   * 读取文件内容
   * @param {string} filePath 文件虚拟路径
   * @param {number} offset 起始行
   * @param {number} limit 行数限制
   */
  async read(filePath, offset = 0, limit) {
    try {
      const parsed = parsePath(filePath);
      if (parsed.tooDeep) return { error: `File not found: ${filePath}` };

      // /agent.md — 长期记忆
      if (parsed.isRootFile === 'agent.md') {
        if (!this.sessionId || !this.appId) return { content: '', mimeType: 'text/markdown' };
        const mem = await AIMemoryRepository.findAgentMemory(this.appId, this.sessionId);
        if (!mem) {
          return {
            content: '# 长期记忆\n此处记录你的角色设定与用户偏好。',
            mimeType: 'text/markdown',
          };
        }
        const raw = mem.content
          || (mem.blocks?.length
            ? await blocksToMarkdown(mem.blocks, { serverRuntime: true, withImage: false })
            : '');
        return {
          content: applyOffsetLimit(raw || '', offset, limit),
          mimeType: 'text/markdown',
        };
      }

      // /<name>/SKILL.md — 技能文档
      if (parsed.docName && parsed.isSkillMd) {
        const doc = await this._fetchOneByName(parsed.docName);
        if (!doc) return { error: `File not found: ${filePath}` };
        const content = await docToMarkdown(doc, this._log);
        return { content: applyOffsetLimit(content, offset, limit), mimeType: 'text/markdown' };
      }

      return { error: `File not found: ${filePath}` };
    } catch (err) {
      return { error: `read 失败: ${err.message}` };
    }
  }

  /**
   * 写入文件（upsert 语义）
   * @param {string} filePath 文件虚拟路径
   * @param {string} content 写入内容
   */
  async write(filePath, content) {
    try {
      const parsed = parsePath(filePath);

      if (parsed.tooDeep) {
        return {
          error:
            '[DatabaseBackend] 禁止创建超过 2 层的目录深度。\n' +
            '所有脚本代码必须内嵌到 /<skill-name>/SKILL.md 的 Markdown 代码块中，' +
            '不得在 /docs 下创建独立脚本文件。',
        };
      }

      // /agent.md — 长期记忆写入
      if (parsed.isRootFile === 'agent.md') {
        if (!this.appId)     return { error: '缺少 appId，无法保存长期记忆' };
        if (!this.sessionId) return { error: '缺少 sessionId，无法保存长期记忆' };
        const blocks = await markdownToBlocks(content);
        const result = await AIMemoryRepository.upsertAgentMemory({
          appId: this.appId, userId: this.userId, sessionId: this.sessionId,
          title: '智能体长期记忆',
          blocks, content,
        });
        this._log(`[DatabaseBackend] 长期记忆已保存 (${result.id})`);
        return { path: filePath };
      }

      // /<name>/SKILL.md — 技能文档写入
      if (parsed.docName && parsed.isSkillMd) {
        if (!this.appId) return { error: '缺少 appId，无法保存技能文档' };

        // 并行查存在性与解析 Markdown (最大化并发)
        const accessFilter = await this.accessFilterPromise;
        const [existingDoc, payload] = await Promise.all([
          DocumentRepository.findOneBySkillName(this.appId, parsed.docName, accessFilter),
          parseSkillMarkdown(content),
        ]);

        return this._writeDoc(existingDoc, payload, filePath);
      }

      return {
        error: `[DatabaseBackend] 不支持的写入路径: ${filePath}。只允许写入 /<skill-name>/SKILL.md 或 /agent.md。`,
      };
    } catch (err) {
      return { error: `write 失败: ${err.message}` };
    }
  }

  /**
   * 编辑文件（读取 → 字符串替换 → 写回）
   * @param {string} filePath 文件虚拟路径
   * @param {string} oldStr 被替换子串
   * @param {string} newStr 替换内容
   * @param {boolean} replaceAll 是否全量替换所有匹配
   */
  async edit(filePath, oldStr, newStr, replaceAll = false) {
    try {
      const parsed = parsePath(filePath);

      if (parsed.docName && parsed.isSkillMd) {
        const doc = await this._fetchOneByName(parsed.docName);
        if (!doc) return { error: `File not found: ${filePath}` };

        const original = await docToMarkdown(doc, this._log);
        const updated  = replaceAll
          ? original.split(oldStr).join(newStr)
          : original.replace(oldStr, newStr);

        if (updated === original) return { error: 'edit 失败：文件中未找到目标字符串' };

        const payload = await parseSkillMarkdown(updated);
        return this._writeDoc(doc, payload, filePath);
      }

      // 通用路径（/agent.md 等）
      const readResult = await this.read(filePath);
      if (readResult.error) return readResult;
      const original = typeof readResult.content === 'string'
        ? readResult.content : new TextDecoder().decode(readResult.content);
      const updated = replaceAll
        ? original.split(oldStr).join(newStr)
        : original.replace(oldStr, newStr);
      if (updated === original) return { error: 'edit 失败：文件中未找到目标字符串' };
      return this.write(filePath, updated);
    } catch (err) {
      return { error: `edit 失败: ${err.message}` };
    }
  }

  /**
   * 全文内容正则检索（PostgreSQL `~` 算子）
   * @param {string} pattern 正则查询字符串
   */
  async grep(pattern, _searchPath, _globPattern) {
    try {
      const meta = await this._fetchMetadata();
      if (meta.length === 0) return { matches: [] };

      const docIds   = meta.map((d) => d.id);
      const idToPath = new Map(meta.map((d) => [String(d.id), `/${metaSafeName(d)}/SKILL.md`]));

      let rows;
      try {
        rows = await DocumentRepository.grepContentPlain(docIds, pattern, 20);
      } catch (pgErr) {
        return { error: `grep 正则无效: ${pgErr.message}` };
      }

      return {
        matches: rows.map((row) => ({
          path:    idToPath.get(String(row.id)) || `/document/${row.id}`,
          content: (row.snippet || '').slice(0, 300),
        })),
      };
    } catch (err) {
      return { error: `grep 失败: ${err.message}` };
    }
  }

  /**
   * 文件名通配匹配（PostgreSQL 正则匹配 title/skillName）
   * @param {string} pattern 通配串
   */
  async glob(pattern, _searchPath) {
    try {
      const results = [];

      if (this.sessionId && globMatches(pattern, '/agent.md')) {
        results.push('/agent.md');
      }

      const meta = await this._fetchMetadata();
      if (meta.length === 0) return { files: results };

      const docIds = meta.map((d) => d.id);

      let namePattern = pattern
        .replace(/^\/+/, '')
        .replace(/\/SKILL\.md$/, '')
        .replace(/\*\*$/g, '*');
      if (!namePattern || namePattern === '*') namePattern = '*';

      const nameRegex =
        '^' +
        namePattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.') +
        '$';

      let rows;
      try {
        rows = await DocumentRepository.matchNameRegex(docIds, nameRegex);
      } catch (pgErr) {
        return { error: `glob 正则无效: ${pgErr.message}` };
      }

      for (const row of rows) {
        results.push(`/${metaSafeName(row)}/SKILL.md`);
      }

      return { files: results };
    } catch (err) {
      return { error: `glob 失败: ${err.message}` };
    }
  }

  /**
   * 批量上传文件
   */
  async uploadFiles(files) {
    const results = [];
    for (const [filePath, content] of files) {
      try {
        const text = typeof content === 'string'
          ? content
          : new TextDecoder().decode(content);
        const writeResult = await this.write(filePath, text);
        results.push({ path: filePath, error: writeResult.error || null });
      } catch (err) {
        results.push({ path: filePath, error: err.message });
      }
    }
    return results;
  }

  /**
   * 批量下载文件（优化至 2 SQL 恒定开销）
   */
  async downloadFiles(paths) {
    const encoder = new TextEncoder();

    let nameToId = new Map();
    try {
      const meta = await this._fetchMetadata();
      for (const row of meta) {
        nameToId.set(metaSafeName(row), String(row.id));
      }
    } catch (err) {
      this._log(`[DatabaseBackend] downloadFiles 预拉取元数据失败: ${err.message}`);
    }

    const targetIds = new Set();
    const parsedPaths = paths.map((p) => {
      const parsed = parsePath(p);
      if (parsed.docName && parsed.isSkillMd) {
        const docId = nameToId.get(parsed.docName);
        if (docId) {
          targetIds.add(docId);
          return { type: 'skill', path: p, docName: parsed.docName, docId };
        }
      }
      if (parsed.isRootFile === 'agent.md') {
        return { type: 'agent', path: p };
      }
      return { type: 'invalid', path: p };
    });

    let docMap = new Map();
    if (targetIds.size > 0) {
      try {
        const docs = await DocumentRepository.findFullByIds(Array.from(targetIds));
        for (const doc of docs) {
          docMap.set(String(doc.id), doc);
        }
      } catch (err) {
        this._log(`[DatabaseBackend] downloadFiles 批量拉取文档失败: ${err.message}`);
      }
    }

    return Promise.all(
      parsedPaths.map(async (info) => {
        try {
          if (info.type === 'invalid') {
            return { content: null, error: `Unsupported path: ${info.path}` };
          }

          if (info.type === 'agent') {
            const r = await this.read(info.path);
            if (r.error) return { content: null, error: r.error };
            const str = typeof r.content === 'string' ? r.content : new TextDecoder().decode(r.content);
            return { content: encoder.encode(str), error: null };
          }

          if (info.type === 'skill') {
            let doc = docMap.get(info.docId);
            if (!doc) {
              doc = await this._fetchOneByName(info.docName);
            }
            if (!doc) {
              return { content: null, error: `File not found: ${info.path}` };
            }

            const content = await docToMarkdown(doc, this._log);
            return { content: encoder.encode(content), error: null };
          }

          return { content: null, error: `Unknown error for path: ${info.path}` };
        } catch (err) {
          return { content: null, error: err.message };
        }
      }),
    );
  }

  /**
   * 原始二进制读取（不支持二进制，友好报错以符合协议规范）
   */
  async readRaw(_filePath) {
    return { error: 'DatabaseBackend 不支持 readRaw。二进制操作请使用沙箱后端（根工作区 /）。' };
  }

  /**
   * 代码执行
   *
   * 逻辑：
   * 1. 检查指令中是否包含虚拟路径 `/docs/`。
   * 2. 如果包含，说明模型试图直接在只读文档目录运行命令，予以拦截并返回步骤引导。
   * 3. 如果不包含（如 `python3 /tmp/run.py` 或 `pip install`），则将请求透明转发给关联的
   *    沙箱后端 (sandboxBackend) 进行物理执行，并返回其实际结果。
   */
  async execute(command) {
    const trimmedCmd = (command || '').trim();

    // 检查是否包含虚拟路径前缀 /docs/
    if (trimmedCmd.includes('/docs/')) {
      return {
        output:
          '[DatabaseBackend] 禁止在只读的 /docs 目录下直接执行代码。\n' +
          '正确操作步骤：\n' +
          '  1. read /docs/<skill-name>/SKILL.md  — 读取技能文档\n' +
          '  2. 提取文档中的代码块（```python / ```bash 等）\n' +
          '  3. write_file /tmp/run.py <code>     — 写入沙箱工作区\n' +
          '  4. execute python3 /tmp/run.py       — 在沙箱中运行',
        exitCode: 1,
        truncated: false,
      };
    }

    if (!this.sandboxBackend) {
      return {
        output: '[DatabaseBackend] 执行失败：未配置关联的 sandboxBackend 沙箱实例，无法执行命令。',
        exitCode: 1,
        truncated: false,
      };
    }

    this._log(`[DatabaseBackend.execute] 转发执行请求到沙箱: "${trimmedCmd}"`);
    return this.sandboxBackend.execute(trimmedCmd);
  }
}

/**
 * 工厂函数（向后兼容入口）
 * @param {object} ctx
 * @returns {DatabaseBackend}
 */
export function createDatabaseBackend(ctx) {
  return new DatabaseBackend(ctx);
}
