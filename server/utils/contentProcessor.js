import { ServerBlockNoteEditor } from '@blocknote/server-util';
import { createCustomSchema } from '../../1shared/src/blocknote/schema.js';

export async function markdownToPlain(md = '') {
  if (!md || typeof md !== 'string') return '';
  let text = md;
  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, '');
  // Remove inline code backticks
  text = text.replace(/`([^`]+)`/g, '$1');
  // Images: ![alt](url) -> alt
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Links: [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // Bold/italic/strikethrough markers
  text = text.replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1');
  // Headings markers
  text = text.replace(/^#{1,6}\s*/gm, '');
  // Blockquotes
  text = text.replace(/^>+\s*/gm, '');
  // Lists markers
  text = text.replace(/^\s*([-*+]|\d+\.)\s+/gm, '');
  // Excess whitespace
  text = text.replace(/\r?\n+/g, '\n');
  text = text.trim();
  return text.slice(0, 20000); // safety truncate
}

/**
 * Extracts content from BlockNote blocks.
 * Unified with Markdown to preserve formatting for AI analysis.
 * @param {Array|string} blocks
 * @returns {Promise<string>}
 */
export async function blocksToPlain(blocks) {
  return blocksToMarkdown(blocks);
}

export async function blocksToMarkdown(
  blocks,
  options = { withImage: false, serverRuntime: false },
) {
  const editor = ServerBlockNoteEditor.create({
    schema: createCustomSchema({
      serverRuntime: options.serverRuntime,
    }),
  });
  let blocksToConvert = blocks;
  if (!options.withImage) {
    blocksToConvert = (blocksToConvert || []).map((b) => {
      if (b.type === 'image') {
        return { type: 'image', props: { ...b.props, url: '' } };
      }
      return b;
    });
  }
  const markdown = await editor.blocksToMarkdownLossy(blocksToConvert);
  // console.log('Converted markdown:', markdown);
  return markdown;
}

export async function markdownToBlocks(markdown) {
  try {
    const editor = ServerBlockNoteEditor.create({ schema: createCustomSchema() });
    return await editor.tryParseMarkdownToBlocks(markdown);
  } catch (err) {
    console.error('Failed to parse markdown to blocks', err);
    return [{ type: 'paragraph', content: [{ type: 'text', text: markdown, styles: {} }] }];
  }
}
