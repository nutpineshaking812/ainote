import { z } from 'zod';

export const blocknoteAdd = {
  name: 'blocknote_add',
  description: 'Insert a new block of content (text/markdown) into the document editor. Use insertAt for absolute positions (beginning/end of document), or blockId+position for relative insertion.',
  inputSchema: z.object({
    docId: z.string().describe('The document ID to insert block into'),
    blockId: z.string().optional().describe('Reference block ID. Used together with position to insert before or after a specific block. Ignored if insertAt is set.'),
    position: z.enum(['before', 'after']).optional().default('after').describe('Insert before or after the reference block. Defaults to after.'),
    insertAt: z.enum(['beginning', 'end']).optional().describe('If set, ignores blockId and inserts at the very beginning or end of the document. Use "beginning" to prepend to the document head.'),
    type: z.string().optional().default('paragraph').describe('Block type (e.g., paragraph, heading, bulletListItem)'),
    content: z.string().describe('The Markdown or text content for the block'),
  }),
  execute: async (args, context) => {
    // Simply echo args. The actual editing and persistence are handled reactive-style by the client-side editor.
    return args;
  }
};

export const blocknoteUpdate = {
  name: 'blocknote_update',
  description: 'Update the text content of a specific block in the document editor.',
  inputSchema: z.object({
    docId: z.string().describe('The document ID'),
    blockId: z.string().describe('The ID of the block to update'),
    content: z.string().describe('New content for the block'),
  }),
  execute: async (args, context) => {
    return args;
  }
};

export const blocknoteDelete = {
  name: 'blocknote_delete',
  description: 'Delete a specific block from the document editor.',
  inputSchema: z.object({
    docId: z.string().describe('The document ID'),
    blockId: z.string().describe('The ID of the block to delete'),
  }),
  execute: async (args, context) => {
    return args;
  }
};
