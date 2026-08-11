import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs, defaultStyleSpecs } from '@blocknote/core';
import { ChildDocumentBlock } from './blocks/ChildDocumentBlock.js';
import { CodeBlock } from './blocks/CodeBlock.js';
import { DocMentionInline } from './blocks/DocMentionInline.js';

const overrideBlockSpecsRender = (blockSpec) => {
  return blockSpec;
}

/**
 * 自定义 BlockNote Schema
 * 包含标准块 + 自定义 TitleBlock
 */
export const createCustomSchema = (options = {}) => {
  const blockOptions = options.blocks ?? {};
  const codeBlockSpec = blockOptions.codeBlock || CodeBlock(options.dependencies, { serverRuntime: options.serverRuntime });
  const inlineOptions = options.inlineContentSpecs ?? {};
  const docMentionSpec = inlineOptions.docMention || DocMentionInline({
    ...options.dependencies,
    serverRuntime: options.serverRuntime,
  });

  return BlockNoteSchema.create({
    blockSpecs: {
      childDocument: ChildDocumentBlock(),
      audio: overrideBlockSpecsRender(defaultBlockSpecs.audio),
      bulletListItem: overrideBlockSpecsRender(defaultBlockSpecs.bulletListItem),
      checkListItem: overrideBlockSpecsRender(defaultBlockSpecs.checkListItem),
      codeBlock: codeBlockSpec,
      divider: overrideBlockSpecsRender(defaultBlockSpecs.divider),
      file: overrideBlockSpecsRender(defaultBlockSpecs.file),
      heading: overrideBlockSpecsRender(defaultBlockSpecs.heading),
      image: overrideBlockSpecsRender(defaultBlockSpecs.image),
      numberedListItem: overrideBlockSpecsRender(defaultBlockSpecs.numberedListItem),
      paragraph: overrideBlockSpecsRender(defaultBlockSpecs.paragraph),
      quote: overrideBlockSpecsRender(defaultBlockSpecs.quote),
      table: overrideBlockSpecsRender(defaultBlockSpecs.table),
      toggleListItem: overrideBlockSpecsRender(defaultBlockSpecs.toggleListItem),
      video: overrideBlockSpecsRender(defaultBlockSpecs.video),
    },
    inlineContentSpecs: {
      ...defaultInlineContentSpecs,
      docMention: docMentionSpec,
    },
    styleSpecs: defaultStyleSpecs,
  });
};

export default createCustomSchema;
