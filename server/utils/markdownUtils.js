import crypto from 'crypto';

/**
 * Markdown Utilities for AI Memory Retrieval and Distillation
 */

/**
 * Generates a stable ID from a string (e.g., section header)
 */
function generateStableId(text) {
  return crypto.createHash('md5').update(text.trim()).digest('hex');
}

/**
 * Splits a markdown string into sections based on hierarchical headers (# to ###).
 * Implements breadcrumb paths and forced chunking for long text.
 * @param {string} markdown
 * @param {object} options { maxChunkSize: 1200, defaultRoot: 'Introduction' }
 * @returns {Array<{header: string, content: string, sectionId: string, hash: string}>}
 */
export function splitMarkdownBySections(markdown = '', options = {}) {
  const { maxChunkSize = 1200, defaultRoot = 'Introduction' } = options;
  if (!markdown) return [];

  const sections = [];
  const lines = markdown.split('\n');

  // Initialize with the root prefix
  let pathStack = [defaultRoot];
  let currentContent = [];
  let partIndex = 1;

  const pushSection = () => {
    const rawContent = currentContent.join('\n').trim();
    if (!rawContent) {
      currentContent = [];
      return;
    }

    // Determine the breadcrumb path with de-duplication
    const breadcrumb = pathStack.reduce((acc, current) => {
      if (!current) return acc;
      if (!acc) return current;
      if (current === acc) return acc;
      // If the current part already starts with the accumulated parent path, don't double it
      if (current.startsWith(acc + ' > ')) return current;
      return `${acc} > ${current}`;
    }, '');

    // Add (Part X) suffix if it's a forced chunk
    const displayTitle = partIndex > 1 ? `${breadcrumb} (Part ${partIndex})` : breadcrumb;

    // Normalize to "## " for system compatibility
    const markdownHeader = `## ${displayTitle}`;

    sections.push({
      header: markdownHeader,
      cleanHeader: displayTitle,
      path: [...pathStack], // Important: shallow copy of current path
      content: rawContent,
      sectionId: generateStableId(markdownHeader),
      hash: generateStableId(markdownHeader + rawContent),
    });

    currentContent = [];
  };

  for (const line of lines) {
    const headerMatch = line.match(/^(#+) (.*)/);

    if (headerMatch) {
      pushSection();
      partIndex = 1;

      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();

      pathStack[level - 1] = title;
      pathStack.splice(level);
    } else {
      currentContent.push(line);
      const currentText = currentContent.join('\n');
      if (currentText.length > maxChunkSize) {
        if (line.trim() === '' || currentText.length > maxChunkSize * 1.5) {
          pushSection();
          partIndex++;
        }
      }
    }
  }

  pushSection();
  return sections;
}

/**
 * Internal helper to get the canonical header string for a given target.
 */
function getCanonicalHeader(targetHeader, options = {}) {
  // If it's already a full header with ##, strip it for processing
  const rawTitle = targetHeader.replace(/^## /, '');
  // Use the splitter logic on a dummy string to see how it would be breadcrumbed
  const dummySections = splitMarkdownBySections(`## ${rawTitle}\nContent`, options);
  return dummySections[0]?.header || `## ${rawTitle}`;
}

/**
 * Extracts a specific section from markdown by its header name.
 */
export function extractSectionByHeader(markdown, targetHeader, options = {}) {
  if (!markdown || !targetHeader) return null;
  const sections = splitMarkdownBySections(markdown, options);

  // 1. 优先尝试精确匹配（如已包含 ## 且对应的 Part 分片头）
  let matched = sections.find((s) => s.header.toLowerCase() === targetHeader.toLowerCase());
  if (matched) return matched.content;

  // 2. 备选：通过 canonical 标准化后匹配
  const canonical = getCanonicalHeader(targetHeader, options);
  matched = sections.find((s) => s.header.toLowerCase() === canonical.toLowerCase());
  return matched ? matched.content : null;
}

/**
 * Updates or appends a section in a markdown string.
 */
export function updateSectionInMarkdown(markdown = '', targetHeader, newContent, options = {}) {
  if (!targetHeader) return markdown;
  const { append = false } = options;
  const sections = splitMarkdownBySections(markdown, options);

  // 1. 优先精确匹配
  let index = sections.findIndex((s) => s.header.toLowerCase() === targetHeader.toLowerCase());
  let canonical = null;

  // 2. 精确匹配失败后使用标准化匹配
  if (index === -1) {
    canonical = getCanonicalHeader(targetHeader, options);
    index = sections.findIndex((s) => s.header.toLowerCase() === canonical.toLowerCase());
  }

  if (index !== -1) {
    if (append) {
      // Append if not already present
      if (!sections[index].content.includes(newContent.trim())) {
        sections[index].content = sections[index].content.trim() + '\n' + newContent;
      }
    } else {
      sections[index].content = newContent;
    }
  } else {
    // When appending, use the canonical path-aware header
    if (!canonical) {
      canonical = getCanonicalHeader(targetHeader, options);
    }
    sections.push({
      header: canonical,
      content: newContent,
    });
  }

  return sections.map((s) => `${s.header}\n${s.content}`).join('\n\n');
}

export default {
  splitMarkdownBySections,
  extractSectionByHeader,
  updateSectionInMarkdown,
};
