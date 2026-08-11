import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

/**
 * 清理 HTML 中的 CSS 样式表、内联样式、类名、链接与脚本，仅保留纯净且安全的语义化标签
 */
function cleanHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // 移除 <style> 块
    .replace(/<link[^>]*>/gi, '')                   // 移除外部样式 link
    .replace(/<meta[^>]*>/gi, '')                   // 移除 meta 标签
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // 安全防范：移除 script 块
    .replace(/\s*style="[^"]*"/gi, '')              // 移除内联样式 style="..."
    .replace(/\s*class="[^"]*"/gi, '')              // 移除样式类 class="..."
    .replace(/\s*id="[^"]*"/gi, '')                 // 移除 id="..."
    .replace(/<!--[\s\S]*?-->/g, '')                // 移除注释
    .replace(/\s+/g, ' ')                           // 压缩空白
    .trim();
}

/**
 * 邮件收取插件处理器
 * @param {Object} params 用户在节点配置 of 输入数据
 * @param {Object} ctx 平台提供的上下文（包括 logger, runtime info 等）
 */
export async function handler(params, ctx) {
  const {
    host,
    port = 993,
    secure = true,
    username,
    password,
    mailbox = 'INBOX',
    limit = 5,
    onlyUnread = true,
    markAsRead = false,
    subjectKeyword,
    sinceDate
  } = params;

  if (!host || !username || !password) {
    throw new Error('IMAP Host, Username, and Password are required fields.');
  }

  ctx.logger.info({ username, host }, '[Plugin/EmailFetcher] Connecting to mail server...');

  const client = new ImapFlow({
    host,
    port: parseInt(port),
    secure,
    auth: {
      user: username,
      pass: password
    },
    logger: false // 禁用 ImapFlow 内部冗长的日志输出
  });

  const emailList = [];

  try {
    // 1. 连接 IMAP 服务
    await client.connect();

    // 2. 选择邮箱锁，默认是收件箱
    // 🛡️ 智能兼容：国内用户常配置为 “收件箱”，但 IMAP 协议（RFC 3501）中收件箱物理名称必须为 "INBOX"
    let targetMailbox = mailbox || 'INBOX';
    if (typeof targetMailbox === 'string') {
      const trimmed = targetMailbox.trim();
      if (trimmed === '收件箱' || trimmed.toUpperCase() === 'INBOX') {
        targetMailbox = 'INBOX';
      }
    }

    const lock = await client.getMailboxLock(targetMailbox);
    try {
      // 3. 构建搜索条件（注意：为了防止国内邮箱 IMAP 服务对中文/双字节字符搜索的 Bug，我们不在服务器端执行 subject 过滤）
      const searchCriteria = {};
      if (onlyUnread) {
        searchCriteria.unseen = true;
      }

      if (sinceDate && String(sinceDate).trim()) {
        const trimmed = String(sinceDate).trim();
        const lowerTrimmed = trimmed.toLowerCase();
        let parsedDate = null;
        let isRangeApplied = false;

        // 🛡️ 智能日期解析拓展：支持自然语言关键字 (yesterday / 昨天 / today / 今天)
        if (lowerTrimmed === 'yesterday' || lowerTrimmed === '昨天') {
          const yesterdayStart = new Date();
          yesterdayStart.setDate(yesterdayStart.getDate() - 1);
          yesterdayStart.setHours(0, 0, 0, 0); // 昨天凌晨 00:00:00

          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0); // 今天凌晨 00:00:00

          searchCriteria.since = yesterdayStart;
          searchCriteria.before = todayStart; // 严格限制在今天零点前，实现“仅限昨天”
          isRangeApplied = true;

          ctx.logger.info(
            { since: yesterdayStart.toISOString(), before: todayStart.toISOString() },
            '[Plugin/EmailFetcher] Applied exclusive YESTERDAY date range filter (Only Yesterday)'
          );
        } else if (lowerTrimmed === 'today' || lowerTrimmed === '今天') {
          const d = new Date();
          d.setHours(0, 0, 0, 0); // 今天凌晨 00:00:00
          parsedDate = d;
        } else {
          // 匹配相对时间偏移：数字（如 1、3）/ 带 d 字母（如 1d、3d）/ "past X days"
          const relativeMatch = trimmed.match(/^(?:past\s+)?(-?\d+)(?:\s*d(?:ay)?s?)?$/i);
          if (relativeMatch) {
            const days = Math.abs(parseInt(relativeMatch[1]));
            parsedDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          } else {
            // 尝试以标准日期格式解析
            const dateObj = new Date(trimmed);
            if (!isNaN(dateObj.getTime())) {
              parsedDate = dateObj;
            }
          }
        }

        if (!isRangeApplied) {
          if (parsedDate) {
            searchCriteria.since = parsedDate;
            ctx.logger.info(
              { sinceDate, calculatedDate: parsedDate.toISOString() },
              '[Plugin/EmailFetcher] Applied sinceDate filter'
            );
          } else {
            ctx.logger.warn({ sinceDate }, '[Plugin/EmailFetcher] Invalid sinceDate format, skipping date filter');
          }
        }
      }

      // 如果未指定任何显式条件，则搜索所有邮件
      if (Object.keys(searchCriteria).length === 0) {
        searchCriteria.all = true;
      }

      // 4. 从服务端快速获取所有符合状态和日期条件的邮件 UID
      let uids = await client.search(searchCriteria, { uid: true });
      if (!uids) uids = [];
      if (!Array.isArray(uids)) {
        uids = [uids];
      }

      // 5. 【客户端高性能中文过滤】批量拉取最近 100 封候选邮件的信封信息进行关键字筛选
      const candidates = [];
      const batchUids = uids.slice(-Math.max(limit * 10, 100)); // 取最新的 100 封候选邮件
      
      if (batchUids.length > 0) {
        ctx.logger.info(
          { batchSize: batchUids.length, subjectKeyword, onlyUnread, sinceDate },
          '[Plugin/EmailFetcher] Fetching envelopes for JS-level filtering...'
        );
        for await (const msg of client.fetch(batchUids, { envelope: true, internalDate: true }, { uid: true })) {
          const subject = msg.envelope?.subject || '';
          const matchKeyword = subjectKeyword && subjectKeyword.trim();
          let isMatch = !matchKeyword || subject.toLowerCase().includes(matchKeyword.toLowerCase());
          
          // 🛡️ 客户端日期强校验：防止阿里/腾讯等邮箱 IMAP 服务端时区偏移或索引失效的 Bug（例如返回前天 24 号数据）
          const emailDate = msg.envelope?.date 
            ? new Date(msg.envelope.date) 
            : (msg.internalDate ? new Date(msg.internalDate) : null);

          if (isMatch && emailDate) {
            if (searchCriteria.since && emailDate < searchCriteria.since) {
              isMatch = false;
            }
            if (searchCriteria.before && emailDate >= searchCriteria.before) {
              isMatch = false;
            }
          }
          
          ctx.logger.info(
            { 
              uid: msg.uid, 
              subject, 
              emailDate: emailDate ? emailDate.toISOString() : null, 
              since: searchCriteria.since ? searchCriteria.since.toISOString() : null,
              before: searchCriteria.before ? searchCriteria.before.toISOString() : null,
              isMatch 
            },
            '[Plugin/EmailFetcher] Checking email subject and date constraints'
          );

          if (isMatch) {
            candidates.push(msg.uid);
          }
        }
      }

      // 降序排列，使最新的邮件排在前面，并截取 limit 数量
      candidates.sort((a, b) => b - a);
      const targetUids = candidates.slice(0, limit);

      ctx.logger.info(
        { totalFound: uids.length, matchedCount: candidates.length, fetchLimit: targetUids.length },
        '[Plugin/EmailFetcher] Filtered target UIDs complete, downloading body sources...'
      );

      // 6. 抓取并解析最终匹配成功的邮件正文
      for (const uid of targetUids) {
        const message = await client.fetchOne(uid, { source: true, flags: true }, { uid: true });
        if (message && message.source) {
          // 使用 mailparser 解析复杂的 MIME 邮件
          const parsed = await simpleParser(message.source);

           // 🛡️ 结构精简与样式过滤：只保留一个 'content' 字段（优先保留无 CSS 样式干扰的语义化 HTML 内容，若无则使用纯文本），省去数据双重冗余，同时方便阅读与解析
           const rawHtml = parsed.html || parsed.textAsHtml || '';
           const emailContent = rawHtml.trim() 
             ? cleanHtml(rawHtml) 
             : (parsed.text || '');

           emailList.push({
             uid,
             subject: parsed.subject || '(无主题)',
             from: parsed.from?.text || '',
             to: parsed.to?.text || '',
             date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
             content: emailContent, // 清理了 CSS 样式的统一正文内容
             hasAttachments: parsed.attachments && parsed.attachments.length > 0
           });

          // 如果勾选了“收取后标记为已读”
          if (markAsRead) {
            await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
          }
        }
      }
    } finally {
      // 释放邮箱锁
      lock.release();
    }

    // 6. 登出客户端
    await client.logout();

    console.log("emailList", emailList);
    return {
      success: true,
      count: emailList.length,
      emails: emailList
    };

  } catch (err) {
    let friendlyMsg = '收取邮件失败，请稍后重试。';
    const errStr = String(err.stack || err.message || err);
    const responseStr = err.response ? (typeof err.response === 'object' ? JSON.stringify(err.response) : String(err.response)) : '';
    const fullErrText = `${errStr} ${responseStr}`;

    if (
      fullErrText.includes('LOGIN failed') ||
      fullErrText.includes('AUTHENTICATIONFAILED') ||
      fullErrText.includes('NO LOGIN')
    ) {
      friendlyMsg = '邮箱账号或密码/授权码错误。请检查账号是否填写完整，并确认已在邮箱设置中开启 IMAP 并使用专门的“客户端授权码”进行登录。';
    } else if (fullErrText.includes('NONEXISTENT')) {
      friendlyMsg = `指定的邮箱文件夹 "${mailbox}" 不存在，请检查文件夹名称是否正确。`;
    } else if (fullErrText.includes('ENOTFOUND') || fullErrText.includes('EAI_AGAIN')) {
      friendlyMsg = `无法解析邮件服务器地址 "${host}"，请检查服务器地址是否正确。`;
    } else if (fullErrText.includes('ETIMEDOUT') || fullErrText.includes('Connection timed out') || fullErrText.includes('TIMEDOUT')) {
      friendlyMsg = '连接邮件服务器超时，请检查 IMAP 端口与安全连接设置（SSL/TLS）是否正确。';
    } else if (fullErrText.includes('ECONNREFUSED')) {
      friendlyMsg = `邮件服务器拒绝连接（端口 ${port}），请确认该服务器是否开启了 IMAP 服务以及端口填写是否正确。`;
    } else {
      friendlyMsg = `邮件服务器错误: ${err.message || err}`;
    }

    // 同时附带上原始的 IMAP 技术参数便于开发人员调试
    // let techDetails = '';
    // if (err.response) {
    //   techDetails += ` (IMAP Response: ${typeof err.response === 'object' ? JSON.stringify(err.response) : err.response})`;
    // }
    // if (err.command) {
    //   techDetails += ` (IMAP Command: ${err.command})`;
    // }
    
    // ctx.logger.error(
    //   { err: err.stack || err, response: err.response, command: err.command, username },
    //   '[Plugin/EmailFetcher] Failed to fetch emails'
    // );
    
    // 发生异常时确保安全登出
    try {
      await client.logout();
    } catch (_) {}
    
    throw new Error(`${friendlyMsg}`);
  }
}
