/**
 * RemoteSandboxBackend — 将 deepagents Backend 协议映射到 OpenSandbox 远程沙盒 API
 *
 * 协议方法（SandboxBackendProtocolV2）：
 *   ls(path)              → sandbox.commands.run('ls -1p')
 *   read(filePath, o, l)  → sandbox.commands.run('cat')
 *   write(filePath, data) → sandbox.commands.run('cat > ...') + mkdir -p
 *   edit(filePath, o, n)  → read + replace + write
 *   grep(pattern, path)   → sandbox.commands.run('grep -rn')
 *   glob(pattern, path)   → sandbox.commands.run('find ... -name')
 *   uploadFiles(files)    → 逐个 write（TextDecoder → heredoc）
 *   downloadFiles(paths)  → 批量 read（TextEncoder）
 *   execute(command)      → sandbox.commands.run(command)
 *   readRaw(filePath)     → 不支持（远程沙盒限制）
 *   id (getter)           → sandbox.sandboxId
 */

/**
 * 创建远程沙盒 Backend 实例
 * @param {object} sandbox - OpenSandbox sandbox 实例
 * @returns {object} 符合 deepagents Backend 协议的对象
 */
export function createRemoteSandboxBackend(executionId, execCtx) {
  let resolvedSandbox = null;
  let sandboxPromise = null;

  async function getSandbox() {
    if (!resolvedSandbox) {
      if (!sandboxPromise) {
        // 只有在第一次被读写或执行命令调用时，才真正触发沙盒的加载/初始化
        const tSandbox = Date.now();
        sandboxPromise = (async () => {
          try {
            const { SandboxManager } = await import('./sandbox-manager.js');
            const sandboxManager = new SandboxManager();
            const tCreate = Date.now();
            const sandbox = await sandboxManager.getOrCreate(executionId);
            console.log(`[DeepAgent] getOrCreate 耗时: ${Date.now() - tCreate}ms, 沙盒已就绪 total=${Date.now() - tSandbox}ms`);
            if (execCtx && typeof execCtx.sendConsoleLog === 'function') {
              execCtx.sendConsoleLog('[DeepAgent] 远程沙盒已就绪');
            }
            return sandbox;
          } catch (err) {
            console.error(`[DeepAgent] 远程沙盒初始化失败 total=${Date.now() - tSandbox}ms: ${err.message}`);
            if (execCtx && typeof execCtx.sendConsoleLog === 'function') {
              execCtx.sendConsoleLog(`[DeepAgent] 远程沙盒初始化跳过: ${err.message}`);
            }
            return null;
          }
        })();
      }
      resolvedSandbox = await sandboxPromise;
    }
    return resolvedSandbox;
  }

  const backendId = `remote-sandbox-lazy-${executionId}`;
  console.log(`[SandboxBackend] 创建 backend 实例: id=${backendId}`);

  /**
   * 安全执行 shell 命令，解析 stdout 日志文本
   */
  async function _runShell(cmd, label) {
    const t0 = Date.now();
    const shortCmd = cmd.length > 80 ? cmd.slice(0, 80) + '...' : cmd;
    console.log(`[SandboxBackend] ${label || 'cmd'} 开始: ${shortCmd}`);
    try {
      const sandbox = await getSandbox();
      if (!sandbox) {
        throw new Error('Sandbox not initialized');
      }
      const r = await sandbox.commands.run(cmd, {
        onStdout: () => {}, // 收集输出到 logs
        onStderr: () => {},
      });
      const elapsed = Date.now() - t0;
      const stdout = (r.logs?.stdout || [])
        .map((l) => l.text || l.line || '')
        .join('');
      const stderr = (r.logs?.stderr || [])
        .map((l) => l.text || l.line || '')
        .join('');
      console.log(
        `[SandboxBackend] ${label || 'cmd'} 完成: exit=${r.exit_code ?? '?'} elapsed=${elapsed}ms`
      );
      return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: r.exit_code ?? 0 };
    } catch (err) {
      const elapsed = Date.now() - t0;
      const diag = _extractErrorDiag(err);
      console.error(
        `[SandboxBackend] ${label || 'cmd'} 失败: ${shortCmd}, error=${err.message}, ` +
        `statusCode=${diag.statusCode}, errorCode=${diag.errorCode}, body=${diag.rawBody}, elapsed=${elapsed}ms`
      );
      return { stdout: '', stderr: err.message || 'Sandbox API error', exitCode: null };
    }
  }

  return {
    /**
     * 列出目录内容。
     */
    async ls(dirPath) {
      // 核心控制：如果沙盒尚未就绪，且请求根路径 '/'，直接秒回空列表，避免阻塞拉起
      if (!resolvedSandbox && (dirPath === '/' || dirPath === '')) {
        console.log(`[SandboxBackend] ls 快速绕过(根目录默认为空): path=${dirPath}`);
        return { files: [] };
      }

      const safePath = _safePath(dirPath);
      const { stdout } = await _runShell(
        `ls -1p '${safePath}' 2>/dev/null || echo '__EMPTY__'`, 'ls'
      );

      if (!stdout || stdout === '__EMPTY__') {
        return { files: [] };
      }

      const prefix = dirPath === '/' ? '' : dirPath;
      const items = stdout
        .split('\n')
        .filter(Boolean)
        .map((name) => {
          const isDir = name.endsWith('/');
          const cleanName = isDir ? name.slice(0, -1) : name;
          const fullPath = `${prefix}/${cleanName}`.replace(/\/+/g, '/');
          return {
            path: fullPath,
            is_dir: isDir,
          };
        });

      return { files: items };
    },

    /**
     * 读取文件内容。
     */
    async read(filePath, offset = 0, limit) {
      const safePath = _safePath(filePath);
      try {
        // 用 cat 读取，简单可靠
        let cmd = `cat '${safePath}' 2>/dev/null`;
        const { stdout, stderr, exitCode } = await _runShell(cmd, 'read');

        if (exitCode !== 0 && !stdout) {
          return { error: `File not found or read error: ${stderr || 'unknown'}` };
        }

        let content = stdout;
        // 模拟 offset/limit
        if (offset > 0 || (limit !== undefined && limit !== null)) {
          const lines = content.split('\n');
          const start = offset || 0;
          const end = limit !== undefined && limit !== null ? start + limit : undefined;
          content = lines.slice(start, end).join('\n');
        }

        return { content, mimeType: 'text/plain' };
      } catch (err) {
        return { error: `Read failed: ${err.message}` };
      }
    },

    /**
     * 写入文件（自动创建父目录）。
     */
    async write(filePath, content) {
      const t0 = Date.now();
      const safePath = _safePath(filePath);
      try {
        const sandbox = await getSandbox();
        if (!sandbox) {
          throw new Error('Sandbox not initialized');
        }
        // 确保父目录存在
        const dir = safePath.substring(0, safePath.lastIndexOf('/'));
        if (dir) {
          await sandbox.commands.run(`mkdir -p '${dir}'`, {
            onStdout: () => {},
            onStderr: () => {},
          });
        }

        // 使用 heredoc 写入，避免转义问题
        const contentSize = content?.length || 0;
        await sandbox.commands.run(
          `cat > '${safePath}' << 'SANDBOX_EOF'\n${content}\nSANDBOX_EOF`,
          {
            onStdout: () => {},
            onStderr: () => {},
          }
        );

        console.log(
          `[SandboxBackend] write 完成: path=${filePath} size=${contentSize} elapsed=${Date.now() - t0}ms`
        );
        return { path: filePath };
      } catch (err) {
        const elapsed = Date.now() - t0;
        const diag = _extractErrorDiag(err);
        console.error(
          `[SandboxBackend] write 失败: path=${filePath} elapsed=${elapsed}ms ` +
          `error=${err.message}, statusCode=${diag.statusCode}, errorCode=${diag.errorCode}, body=${diag.rawBody}`
        );
        return { error: `Write failed: ${err.message}` };
      }
    },

    /**
     * 编辑文件（读取 → 替换 → 写回）。
     */
    async edit(filePath, oldStr, newStr) {
      const result = await this.read(filePath);
      if (result.error) return result;

      const updated = result.content.replace(oldStr, newStr);
      if (updated === result.content) {
        return { error: 'oldStr not found in file' };
      }
      return this.write(filePath, updated);
    },

    /**
     * 文本搜索（使用 grep -rn）。
     */
    async grep(pattern, filePath, globPattern) {
      // 转义特殊字符
      const escaped = pattern.replace(/'/g, "'\\''");
      const targetPath = filePath ? `'${_safePath(filePath)}'` : '.';
      const globFlag = globPattern ? ` --include='${globPattern.replace(/'/g, "'\\''")}'` : '';

      const { stdout } = await _runShell(
        `grep -rn '${escaped}' ${targetPath}${globFlag} 2>/dev/null || true`, 'grep'
      );

      if (!stdout) return { matches: [] };

      const matches = stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const idx = line.indexOf(':');
          return {
            filePath: line.slice(0, idx),
            line: line.slice(idx + 1).substring(0, 300),
          };
        });

      return { matches };
    },

    /**
     * 文件名通配搜索（使用 find -name）。
     */
    async glob(pattern, filePath) {
      const searchPath = filePath ? `'${_safePath(filePath)}'` : '.';
      const { stdout } = await _runShell(
        `find ${searchPath} -name '${pattern.replace(/'/g, "'\\''")}' 2>/dev/null || true`, 'glob'
      );

      if (!stdout) return { files: [] };

      const files = stdout.split('\n').filter(Boolean).map((p) => p.replace(/^\.\//, ''));
      return { files };
    },

    /**
     * 批量上传文件到沙盒。
     */
    async uploadFiles(files) {
      const results = [];
      for (const [filePath, content] of files) {
        try {
          const text = new TextDecoder().decode(content);
          const writeResult = await this.write(filePath, text);
          results.push({
            path: filePath,
            error: writeResult.error || null,
          });
        } catch (err) {
          results.push({ path: filePath, error: err.message });
        }
      }
      return results;
    },

    /**
     * 批量下载文件（返回 TextEncoder 编码的内容数组）。
     */
    async downloadFiles(paths) {
      const results = [];
      for (const p of paths) {
        try {
          const result = await this.read(p);
          if (result.error) {
            results.push({ content: null, error: result.error });
          } else {
            results.push({
              content: new TextEncoder().encode(result.content),
              error: null,
            });
          }
        } catch (err) {
          results.push({ content: null, error: err.message });
        }
      }
      return results;
    },

    /**
     * 原始二进制读取（OpenSandbox 不支持，返回错误）。
     */
    async readRaw(filePath) {
      return { error: 'Raw binary read not supported in remote sandbox' };
    },

    /**
     * 沙盒唯一标识。
     */
    get id() {
      return backendId;
    },

    /**
     * 执行命令（deepagents 内置 execute 工具会调用此方法）。
     */
    async execute(command) {
      const startTime = Date.now();
      try {
        const sandbox = await getSandbox();
        if (!sandbox) {
          throw new Error('Sandbox not initialized');
        }
        const r = await sandbox.commands.run(command, {
          onStdout: () => {},
          onStderr: () => {},
        });
        const stdout = (r.logs?.stdout || [])
          .map((l) => l.text || l.line || '')
          .join('');
        const stderr = (r.logs?.stderr || [])
          .map((l) => l.text || l.line || '')
          .join('');
        const output = [stdout, stderr ? `[stderr] ${stderr}` : '']
          .filter(Boolean)
          .join('\n');
        const elapsed = Date.now() - startTime;
        console.log(
          `[Sandbox.execute] command="${command}" exitCode=${r.exit_code ?? 'null'} elapsed=${elapsed}ms`
        );
        return {
          output,
          exitCode: r.exit_code ?? null,
          truncated: false,
        };
      } catch (err) {
        const elapsed = Date.now() - startTime;
        const diag = _extractErrorDiag(err);
        console.error(
          `[Sandbox.execute] command="${command}" FAILED elapsed=${elapsed}ms ` +
          `error=${err.message}, statusCode=${diag.statusCode}, errorCode=${diag.errorCode}, body=${diag.rawBody}`
        );
        return {
          output: `Execution failed: ${err.message}`,
          exitCode: null,
          truncated: false,
        };
      }
    },
  };
}

/**
 * 从异常中提取 SandboxApiException 的诊断信息。
 * @param {Error} err
 * @returns {{ statusCode: string, errorCode: string, rawBody: string }}
 */
function _extractErrorDiag(err) {
  return {
    statusCode: err?.statusCode ?? 'N/A',
    errorCode: err?.error?.code ?? 'N/A',
    rawBody: typeof err?.rawBody === 'object'
      ? JSON.stringify(err.rawBody).slice(0, 200)
      : (typeof err?.rawBody === 'string' ? err.rawBody.slice(0, 200) : 'N/A'),
  };
}

/**
 * 路径安全化：移除危险字符，确保路径在沙盒内。
 */
function _safePath(p) {
  if (!p || p === '/') return '/';
  // 移除 .. 防止目录穿越
  let clean = p.replace(/\.\./g, '');
  // 确保以 / 为根
  if (!clean.startsWith('/')) {
    clean = '/' + clean;
  }
  return clean.replace(/\/+/g, '/');
}
