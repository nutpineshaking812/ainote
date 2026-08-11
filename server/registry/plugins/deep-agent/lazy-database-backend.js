import DocumentRepository from '../../../repositories/document.repository.js';
import AIMemoryRepository from '../../../repositories/aiMemory.repository.js';
import documentService from '../../../services/document.service.js';
import { blocksToMarkdown, markdownToBlocks } from '../../../utils/contentProcessor.js';
import { safeName, getUserContext, SKILL_REF_REGEX } from './utils.js';

// ==================== fetchDocs TTL 缓存 ====================
// 短 TTL 保证新创建的文档能被 Agent 快速感知，同时避免同一轮对话内重复查询
const DOCS_CACHE_TTL = 5000; // 5 秒
const docsCache = new Map();

function cacheKey(userId, appId, idList) {
  return `${userId || ''}:${appId || ''}:${(idList || []).join(',')}`;
}

function cacheGet(key) {
  const entry = docsCache.get(key);
  if (entry && Date.now() - entry.ts < DOCS_CACHE_TTL) return entry.data;
  docsCache.delete(key);
  return null;
}

function cacheSet(key, data) {
  docsCache.set(key, { data, ts: Date.now() });
}

/** 供外部手动失效缓存（创建/更新文档后调用） */
export function invalidateDocsCache(userId, appId) {
  const prefix = `${userId || ''}:${appId || ''}`;
  for (const key of docsCache.keys()) {
    if (key.startsWith(prefix)) {
      docsCache.delete(key);
    }
  }
}

/**
 * 根据用户和应用权限，从数据库查询所有文档（不区分 SKILL / KNOWLEDGE）
 * 结果带 30s TTL 缓存，同一轮对话中避免重复查询
 *
 * 注意：当 id 列表为空时，不传 docIds 参数，以返回所有有权限的文档。
 * 否则 findByPurpose 会因空数组走入 `d.eq(t.id, '')` 分支导致永远查不到数据。
 */
async function fetchDocs(userId, appId, idList) {
  const key = cacheKey(userId, appId, idList);
  const cached = cacheGet(key);
  if (cached) return cached;

  const context = await getUserContext(userId, appId);
  // purpose=null → 取所有非 ai_memory 的文档（包含 SKILL + KNOWLEDGE）
  const result = await DocumentRepository.findByPurpose({
    userId,
    appId,
    purpose: null,
    docIds: idList && idList.length > 0 ? idList : undefined,
    context,
  });

  cacheSet(key, result);
  return result;
}

/**
 * 创建 deepagents 协议所需的 backend 对象（ls / read / write / edit）
 *
 * 统一 /docs 路由，承载：
 *   - 技能/知识文档（DocumentRepository，只读）
 *   - 长期记忆 agent.md（AIMemoryRepository，可读写）
 *
 * 虚拟文件结构：
 *   /                     → 文档目录列表 + agent.md
 *   /<doc-name>/SKILL.md  → 文档内容（含 frontmatter + allowed-tools）
 *   /agent.md             → 长期记忆内容
 *
 * 注意：CompositeBackend 会剥掉 routePrefix 后再调用子 backend。
 *   例如 ls("/docs")       → 子 backend 收到 ls("/")
 *   例如 ls("/docs/foo")   → 子 backend 收到 ls("/foo")
 */
export function createLazyBackend(ctx) {
  const { userId, appId, logger, allDocIds, sessionId } = ctx;
  const log = (msg) => logger?.sendConsoleLog?.(msg);

  return {
    /** deepagents ls 协议 */
    async ls(dirPath) {
      try {
        const normalized = dirPath.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
        const cleanPath = normalized === '/' ? '/' : `${normalized}/`;

        // console.log("cleanPath==>", cleanPath, userId, appId, allDocIds);
        // 根目录：列出所有文档 + agent.md
        if (cleanPath === '/') {
          const docs = await fetchDocs(userId, appId, allDocIds);
          const files = docs.map((doc) => ({
            path: `/${safeName(doc)}`,
            is_dir: true,
          }));
          // 有会话上下文时展示长期记忆文件
          if (sessionId) {
            files.push({ path: '/agent.md', is_dir: false });
          }
          return { files };
        }

        // 子目录：列出 SKILL.md
        const targetSafeName = cleanPath.split('/')[1];
        // console.log("targetSafeName==>", targetSafeName);
        if (targetSafeName) {
          const docs = await fetchDocs(userId, appId, allDocIds);
          const matched = docs.find((doc) => safeName(doc) === targetSafeName);
          if (matched) {
            return { files: [{ path: `${cleanPath}SKILL.md`, is_dir: false }] };
          }
        }

        return { files: [] };
      } catch (err) {
        return { error: `Failed to list directory: ${err.message}` };
      }
    },

    /** deepagents read 协议 */
    async read(filePath, _offset = 0, _limit = 500) {
      try {
        const normalizedPath = filePath.replace(/\/+/g, '/');

        // 1. 长期记忆：/agent.md
        if (normalizedPath === '/agent.md') {
          if (!sessionId) return { content: '', mimeType: 'text/markdown' };
          if (!appId) return { content: '', mimeType: 'text/markdown' };
          const mem = await AIMemoryRepository.findAgentMemory(appId, sessionId);
          if (!mem) {
            return {
              content: '# 长期记忆\n此处记录你的角色设定与用户偏好。',
              mimeType: 'text/markdown',
            };
          }
          const content = mem.content
            || (mem.blocks?.length
              ? await blocksToMarkdown(mem.blocks, { serverRuntime: true, withImage: false })
              : '');
          return { content: content || '', mimeType: 'text/markdown' };
        }

        // 2. 文档：/<doc-name>/SKILL.md
        const parts = normalizedPath.split('/');
        if (parts[2] !== 'SKILL.md') {
          return { error: `File not found: ${filePath}` };
        }

        const targetSafeName = parts[1];
        const docs = await fetchDocs(userId, appId, allDocIds);
        const matched = docs.find((doc) => safeName(doc) === targetSafeName);

        if (!matched) return { error: `File not found: ${filePath}` };

        const docId = String(matched.id);
        const doc = await documentService.getSingle(docId, userId);
        if (!doc || !doc.blocks) return { error: `Document "${targetSafeName}" is empty.` };

        const displayName = matched.skillName || matched.title || targetSafeName;
        const description = matched.description || matched.title || '';
        log(`[DeepAgent] 懒加载精读文档: ${displayName}...`);

        const bodyContent = await blocksToMarkdown(doc.blocks, {
          serverRuntime: true,
          withImage: false,
        });

        // 始终提取 allowed-tools（不区分 SKILL / KNOWLEDGE）
        const frontmatterLines = ['---', `name: ${displayName}`, `description: ${description}`];
        const allowedTools = new Set();
        let refMatch;
        SKILL_REF_REGEX.lastIndex = 0;
        while ((refMatch = SKILL_REF_REGEX.exec(bodyContent)) !== null) {
          const type = refMatch[1].trim();
          const refId = refMatch[2].trim();
          if (type === 'tool' || type === 'mcp') {
            allowedTools.add(refId);
          }
        }
        if (allowedTools.size > 0) {
          frontmatterLines.push('allowed-tools:');
          for (const toolName of allowedTools) {
            frontmatterLines.push(`  - ${toolName}`);
          }
        }
        frontmatterLines.push('---', '');

        return {
          content: frontmatterLines.join('\n') + bodyContent,
          mimeType: 'text/markdown',
        };
      } catch (err) {
        return { error: `Failed to read document: ${err.message}` };
      }
    },

    /**
     * deepagents downloadFiles 协议：批量读取文件
     * 被 BackendSkillsMiddleware 和 MemoryMiddleware 用于自动加载技能/知识/记忆内容。
     */
    async downloadFiles(paths) {
      const encoder = new TextEncoder();
      const results = [];

      for (const filePath of paths) {
        try {
          const readResult = await this.read(filePath);
          if (readResult.error) {
            results.push({ content: null, error: readResult.error });
          } else if (readResult.content) {
            const contentStr = typeof readResult.content === 'string'
              ? readResult.content
              : new TextDecoder().decode(readResult.content);
            results.push({ content: encoder.encode(contentStr), error: null });
          } else {
            results.push({ content: null, error: 'file_not_found' });
          }
        } catch (err) {
          results.push({ content: null, error: err.message });
        }
      }

      return results;
    },

    /** 仅长期记忆支持写入 */
    async write(filePath, content) {
      try {
        const normalizedPath = filePath.replace(/\/+/g, '/');
        if (normalizedPath !== '/agent.md') {
          return { error: 'Read-only directory' };
        }
        if (!appId) return { error: 'App context required to save memory' };
        if (!sessionId) return { error: 'Session context required to save memory' };

        const blocks = await markdownToBlocks(content);

        const result = await AIMemoryRepository.upsertAgentMemory({
          appId,
          userId,
          sessionId,
          title: '智能体长期记忆',
          blocks,
          content,
        });

        log(`[DeepAgent] 长期记忆已保存 (${result.id})`);
        return { path: filePath, filesUpdate: null };
      } catch (err) {
        return { error: `Failed to write memory: ${err.message}` };
      }
    },

    /** 仅长期记忆支持编辑 */
    async edit(filePath, oldString, newString, replaceAll = false) {
      try {
        const normalizedPath = filePath.replace(/\/+/g, '/');
        if (normalizedPath !== '/agent.md') {
          return { error: 'Read-only directory' };
        }
        if (!sessionId) return { error: 'Session context required to edit memory' };
        const readRes = await this.read(filePath);
        if ('error' in readRes || !readRes.content) {
          return { error: 'Failed to read memory file before editing' };
        }

        const originalContent =
          typeof readRes.content === 'string'
              ? readRes.content
              : new TextDecoder().decode(readRes.content);

        let finalContent = originalContent;
        if (replaceAll) {
          finalContent = originalContent.split(oldString).join(newString);
        } else {
          finalContent = originalContent.replace(oldString, newString);
        }

        await this.write(filePath, finalContent);
        return { path: filePath, result: 'SUCCESS' };
      } catch (err) {
        return { error: `Failed to edit memory: ${err.message}` };
      }
    },

    /** @deprecated */
    async readRaw(_filePath) {
      return { error: 'Not supported' };
    },

    /**
     * deepagents grep 协议：直接用 PostgreSQL 正则在 content_plain 上搜索
     */
    async grep(pattern, _searchPath, _globPattern) {
      try {
        const docs = await fetchDocs(userId, appId, allDocIds);

        if (docs.length === 0) return { matches: [] };

        const docIds = docs.map((d) => d.id);

        const rows = await DocumentRepository.grepContentPlain(docIds, pattern, 20);

        const idToMeta = new Map(docs.map((doc) => [
          String(doc.id),
          { path: `/${safeName(doc)}/SKILL.md`, title: doc.title || doc.skillName || safeName(doc) },
        ]));

        const matches = rows.map((row) => ({
          path: idToMeta.get(String(row.id))?.path || `/document/${row.id}`,
          content: (row.snippet || '').slice(0, 200),
        }));

        return { matches };
      } catch (err) {
        return { error: `Failed to grep: ${err.message}` };
      }
    },

    /**
     * deepagents glob 协议：匹配文档名称
     */
    async glob(pattern, _searchPath) {
      try {
        const results = [];

        // 检查是否匹配 agent.md
        if (sessionId) {
          const fullGlobRegex = new RegExp(
            '^' +
              pattern
                .replace(/[.+^${}()|[\]\\]/g, '\\$&')
                .replace(/\*\*/g, '<<<GLOBSTAR>>>')
                .replace(/\*/g, '[^/]*')
                .replace(/<<<GLOBSTAR>>>/g, '.*')
                .replace(/\?/g, '.') +
              '$',
          );
          if (fullGlobRegex.test('/agent.md')) {
            results.push('/agent.md');
          }
        }

        const docs = await fetchDocs(userId, appId, allDocIds);

        if (docs.length === 0) return { files: results };

        // 从 glob 中提取文档名称模式: 去掉 /SKILL.md 等路径结构
        let namePattern = pattern
          .replace(/^\/+/, '')
          .replace(/\/SKILL\.md$/, '')
          .replace(/\*\*$/g, '*');
        if (!namePattern || namePattern === '*') namePattern = '*';

        // glob → PostgreSQL regex
        const nameRegex = '^' +
          namePattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.') +
          '$';

        const docIds = docs.map((d) => d.id);

        const rows = await DocumentRepository.matchNameRegex(docIds, nameRegex);

        for (const row of rows) {
          results.push(`/${safeName(row)}/SKILL.md`);
        }

        return { files: results };
      } catch (err) {
        return { error: `Failed to glob: ${err.message}` };
      }
    },
  };
}
