// Build initial BlockNote content for editor
// Pure function: safe for client/server usage

/**
 * @param {string} initialTitle - (unused, kept for API compatibility)
 * @param {Array} initialBlocks
 * @param {Array} childDocs - array of { _id, title }
 * @param {{_id?: string, name?: string}} originalFileInfo - (unused, kept for API compatibility)
 * @param {string} placeholder - (unused, kept for API compatibility)
 * @returns {Array} blocks
 */
export function buildInitialContent(initialTitle, initialBlocks = [], childDocs = [], originalFileInfo = {}, placeholder = '请输入文档标题') {
  const baseBlocks = Array.isArray(initialBlocks) ? initialBlocks : [];

  const validChildDocIds = new Set(childDocs.map(d => d._id));

  const childBlockMap = new Map(childDocs.map(doc => [
    doc._id,
    { type: 'childDocument', props: { id: `child-doc-${doc._id}`, title: doc.title, docId: doc._id, type: doc.type } },
  ]));

  const bodyBlocks = baseBlocks
    .filter(block => {
      if (block.type === 'childDocument') {
        const id = block.props?.docId;
        return validChildDocIds.has(id);
      }
      return true;
    })
    .map(block => {
      // 动态数据平滑升级：将历史遗留的独立 mermaid 块，在挂载前一键转换为我们统一的 codeBlock 格式！
      if (block.type === 'mermaid') {
        return {
          id: block.id,
          type: 'codeBlock',
          props: {
            language: 'mermaid',
            viewMode: 'split',
          },
          content: [
            {
              type: 'text',
              text: block.props?.diagram || '',
            },
          ],
        };
      }

      if (block.type === 'childDocument') {
        const id = block.props?.docId;
        if (childBlockMap.has(id)) {
          const childBlock = childBlockMap.get(id);
          childBlockMap.delete(id);
          return childBlock;
        }
      }
      block.props = { ...block.props };
      return block;
    });

  // Append missing child docs
  childBlockMap.forEach(value => {
    bodyBlocks.push(value);
  });

  const emptyBlock = { type: 'paragraph', content: [{ type: 'text', text: '' }] };
  return bodyBlocks.length === 0 ? [emptyBlock] : bodyBlocks;
}
