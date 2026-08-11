import { logger } from '../config/logger.js';

export async function compileDocumentBlockPrompt(blocks) {
  let stateBlocks = [];
  try {
    const { ServerBlockNoteEditor } = await import('@blocknote/server-util');
    const { createCustomSchema } = await import('../../1shared/src/blocknote/schema.js');
    const editor = ServerBlockNoteEditor.create({ schema: createCustomSchema() });
    for (const block of blocks || []) {
      const html = await editor.blocksToHTMLLossy([block]);
      stateBlocks.push({
        id: block.id + '$',
        block: html.trim(),
      });
    }
  } catch (err) {
    logger.error(
      { err },
      '[compileDocumentBlockPrompt] Failed to compile blocks via ServerBlockNoteEditor, using fallback',
    );
    stateBlocks = (blocks || []).map((b) => ({
      id: (b.id ? b.id.replace(/\$$/, '') : '') + '$',
      block: `<p>${typeof b.content === 'string' ? b.content : JSON.stringify(b.content || '')}</p>`,
    }));
  }

  return `There is no active selection. This is the latest state of the document (ignore previous documents, you MUST issue operations against this latest version of the document). 
Prefer updating existing blocks over removing and adding (but this also depends on the user's question).
Document State (blocks with IDs):
${JSON.stringify(stateBlocks)}
`;
}

const ss = `
You can modify the document contents incrementally using these tools:
- \`blocknote_add(docId, content, blockId, type)\`: Insert a block after blockId.
- \`blocknote_update(docId, blockId, content)\`: Update text content of blockId.
- \`blocknote_delete(docId, blockId)\`: Delete blockId.
When using these tools, you must target the correct block IDs listed above (e.g., "8d0441ba-ce39-40e6-8b6a-d23073e7ec11$").`;
