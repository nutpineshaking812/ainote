import { useEffect, useRef } from 'react';
import { ShowSelectionExtension } from '@blocknote/core';
import resourceEventBus from '../../../pages/app-detail/utils/resourceEventBus.js';

// Generate a simple unique ID for pre-assigning block IDs before insertion
const genId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11) + Date.now().toString(36);

// === AI highlight helpers ===

// Find block OUTER wrapper elements by block ID array (bn-block-outer contains bn-block[data-id])
const getBlockEls = (editor, blockIds) => {
  if (!editor?.domElement || !blockIds?.length) return [];
  return blockIds
    .map((id) => {
      // BlockNote structure: .bn-block-outer > .bn-block[data-id]
      const inner = editor.domElement.querySelector(`[data-id="${id}"]`);
      return inner?.closest('.bn-block-outer') ?? inner ?? null;
    })
    .filter(Boolean);
};

// Directly apply red color and line-through styles on DOM elements for high fidelity deletion feedback
const applyVisualStrikethrough = (editor, blockId) => {
  try {
    const els = getBlockEls(editor, [blockId]);
    if (els.length > 0) {
      const outerEl = els[0];
      outerEl.classList.add('ai-deleting-generating');
      const targetEls = outerEl.querySelectorAll(
        '.bn-inline-content, [contenteditable="true"], [data-content-type]',
      );
      if (targetEls.length > 0) {
        targetEls.forEach((el) => {
          el.style.setProperty('text-decoration', 'line-through', 'important');
          el.style.setProperty('color', '#ff4d4f', 'important');
        });
      } else {
        outerEl.style.setProperty('text-decoration', 'line-through', 'important');
        outerEl.style.setProperty('color', '#ff4d4f', 'important');
      }
      // console.log(`[BN-Stream] applyVisualStrikethrough - Applied to block: ${blockId}`);
    }
  } catch (err) {
    console.warn('[useBlockNoteStreamAction] applyVisualStrikethrough failed:', err);
  }
};

// Directly style the old block being updated with orange dashed line-through
const applyVisualUpdateOld = (editor, blockId) => {
  try {
    const els = getBlockEls(editor, [blockId]);
    if (els.length > 0) {
      const outerEl = els[0];
      outerEl.classList.add('ai-updating-old');
      const targetEls = outerEl.querySelectorAll(
        '.bn-inline-content, [contenteditable="true"], [data-content-type]',
      );
      if (targetEls.length > 0) {
        targetEls.forEach((el) => {
          el.style.setProperty('text-decoration', 'line-through', 'important');
          el.style.setProperty('color', '#fa8c16', 'important');
          el.style.setProperty('font-style', 'italic', 'important');
        });
      } else {
        outerEl.style.setProperty('text-decoration', 'line-through', 'important');
        outerEl.style.setProperty('color', '#fa8c16', 'important');
        outerEl.style.setProperty('font-style', 'italic', 'important');
      }
      // console.log(`[BN-Stream] applyVisualUpdateOld - Styled block as old: ${blockId}`);
    }
  } catch (err) {
    console.warn('[useBlockNoteStreamAction] applyVisualUpdateOld failed:', err);
  }
};

// Scroll the block into view smoothly or instantly using requestAnimationFrame to ensure ProseMirror DOM render is completed
const scrollBlockIntoView = (editor, blockId) => {
  if (!editor || !blockId) return;
  requestAnimationFrame(() => {
    const els = getBlockEls(editor, [blockId]);
    if (els.length > 0) {
      els[0].scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  });
};

// Add pulsing left-border animation during streaming (loading indicator)
const markGenerating = (editor, blockIds) => {
  getBlockEls(editor, blockIds).forEach((el) => {
    el.classList.remove('ai-done');
    el.classList.add('ai-generating');
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
};

// Remove generating class
const clearGenerating = (editor, blockIds) => {
  getBlockEls(editor, blockIds).forEach((el) => {
    el.classList.remove('ai-generating');
    el.classList.remove('ai-deleting-generating');
    el.classList.remove('ai-updating-old');
  });
};

/**
 * Official highlight via ShowSelectionExtension:
 * Sets the ProseMirror selection to span the given blocks, then calls
 * showSelection(true) so the decoration stays visible even without editor focus.
 * After `durationMs` the highlight is removed.
 */
const highlightBlocksOfficial = (editor, firstId, lastId, durationMs = 2000) => {
  try {
    // Set ProseMirror selection to cover the blocks
    editor.setSelection(firstId, lastId);
  } catch (e) {
    try {
      // Fallback: single block or empty block
      editor.setTextCursorPosition(firstId, 'start');
    } catch (_) {}
  }

  try {
    const selExt = editor.getExtension(ShowSelectionExtension);
    if (!selExt) return;
    selExt.showSelection(true, 'aiHighlight');
    setTimeout(() => {
      try {
        selExt.showSelection(false, 'aiHighlight');
      } catch (_) {}
    }, durationMs);
  } catch (e) {
    console.warn('[aiHighlight] ShowSelectionExtension not available:', e);
  }
};

const extractPartialContent = (jsonStr) => {
  const match = jsonStr.match(/"content"\s*:\s*"/);
  if (!match) return '';
  const startIndex = match.index + match[0].length;
  const rest = jsonStr.substring(startIndex);
  let content = '';
  let escaped = false;
  for (let i = 0; i < rest.length; i++) {
    const char = rest[i];
    if (escaped) {
      if (char === 'n') content += '\n';
      else if (char === 't') content += '\t';
      else content += char;
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '"') {
      break;
    } else {
      content += char;
    }
  }
  return content;
};

const extractBlockId = (jsonStr) => {
  const match = jsonStr.match(/"blockId"\s*:\s*"([^"]+)"/);
  return match ? match[1].replace(/\$$/, '') : null;
};

const extractType = (jsonStr) => {
  const match = jsonStr.match(/"type"\s*:\s*"([^"]+)"/);
  return match ? match[1] : 'paragraph';
};

const findRealBlockId = (editor, id) => {
  // console.log('[findRealBlockId] Input ID to resolve:', id);
  if (!editor || !id) return id;
  try {
    const block = editor.getBlock(id);
    if (block) {
      // console.log('[findRealBlockId] Successfully found raw ID:', id);
      return id;
    }
  } catch (e) {
    // console.log('[findRealBlockId] getBlock for raw ID threw:', e?.message || e);
  }
  try {
    const blockWithDollar = editor.getBlock(id + '$');
    if (blockWithDollar) {
      // console.log('[findRealBlockId] Successfully found ID with trailing dollar:', id + '$');
      return id + '$';
    }
  } catch (e) {
    // console.log('[findRealBlockId] getBlock for ID with dollar threw:', e?.message || e);
  }
  // console.log(
  //   '[findRealBlockId] Could not resolve ID using getBlock. Scanning active document blocks...',
  // );
  try {
    const allIds = editor.document.map((b) => b.id);
    // console.log('[findRealBlockId] All current document Block IDs:', allIds);
  } catch (e) {
    console.warn('[findRealBlockId] Failed to map document Block IDs:', e);
  }
  return id;
};

// Resolve the reference block and position for insertBlocks based on insertAt / blockId / position
const resolveInsertTarget = (editor, insertAt, blockId, position) => {
  if (insertAt === 'beginning') {
    const firstBlock = editor.document[0];
    return { refBlock: firstBlock?.id ?? null, pos: 'before' };
  }
  if (insertAt === 'end') {
    const lastBlock = editor.document[editor.document.length - 1];
    return { refBlock: lastBlock?.id ?? null, pos: 'after' };
  }

  let refBlock = findRealBlockId(editor, blockId);
  let refExists = false;
  if (refBlock) {
    try {
      if (editor.getBlock(refBlock)) {
        refExists = true;
      }
    } catch (_) {}
  }

  if (refExists) {
    return { refBlock, pos: position || 'after' };
  } else {
    // Safety fallback: if target block is missing, append to document end
    const lastBlock = editor.document[editor.document.length - 1];
    return { refBlock: lastBlock?.id ?? null, pos: 'after' };
  }
};

export const useBlockNoteStreamAction = (editor, usageId) => {
  const activeStreamsRef = useRef({});
  const lastInsertParamsRef = useRef(null);
  const lastInsertedBlockIdRef = useRef(null);
  const finishedToolCallsRef = useRef(new Set());

  useEffect(() => {
    if (!editor || !usageId) return;

    const handleBlockAction = async (message) => {
      const { docId, event, payload } = message;
      const { toolName, input, inputTextDelta } = payload || {};
      // Debug: Incoming blocknote stream action message
      const cleanDocId = String(docId || '')
        .replace(/['"]/g, '')
        .trim()
        .toLowerCase();
      const cleanUsageId = String(usageId || '')
        .replace(/['"]/g, '')
        .trim()
        .toLowerCase();
      if (cleanDocId !== cleanUsageId) {
        console.warn(
          `[BN-Stream] docId mismatch: message.docId=${docId} (clean=${cleanDocId}) active.usageId=${usageId} (clean=${cleanUsageId})`,
        );
        return;
      }

      const toolCallId = payload.toolCallId || 'default-call-id';

      // Initialize buffer for this stream if it doesn't exist
      if (!activeStreamsRef.current[toolCallId]) {
        activeStreamsRef.current[toolCallId] = {
          accumulated: '',
          hasInserted: false,
          hasStyledOld: false,
          hasStruckThrough: false,
          tempBlockId: null,
          targetBlockId: null,
          insertAt: null,
          position: 'after',
          blockType: 'paragraph',
        };
      }

      const stream = activeStreamsRef.current[toolCallId];

      if (event === 'tool-input-delta' && inputTextDelta) {
        stream.accumulated += inputTextDelta;

        // Try parsing parameters from the current stream buffer
        let content = extractPartialContent(stream.accumulated);
        // Strip basic HTML tags from real-time preview so the editor doesn't show raw HTML tags
        if (content.includes('<') && content.includes('>')) {
          content = content.replace(/<\/?[^>]+(>|$)/g, '');
        }

        const refBlockId = extractBlockId(stream.accumulated) || stream.targetBlockId;
        if (refBlockId && !stream.targetBlockId) {
          stream.targetBlockId = refBlockId;
        }

        // Extract insertAt and position from stream buffer as they arrive
        const insertAtMatch = stream.accumulated.match(/"insertAt"\s*:\s*"([^"]+)"/);
        if (insertAtMatch && !stream.insertAt) {
          stream.insertAt = insertAtMatch[1];
        }
        const positionMatch = stream.accumulated.match(/"position"\s*:\s*"([^"]+)"/);
        if (positionMatch) {
          stream.position = positionMatch[1];
        }

        const bType = extractType(stream.accumulated);
        if (bType) {
          stream.blockType = bType;
        }

        const cleanContent = content ? content.replace(/\r?\n/g, ' ') : '';

        if (toolName === 'add') {
          // We must collect enough prior positioning parameters.
          // In Zod schema, 'content' is always at the end, so waiting for '"content"' key ensures insertAt/position/blockId are parsed.
          const hasEnoughParams = stream.accumulated.includes('"content"');
          if (!hasEnoughParams) return;

          const content_preview = cleanContent.slice(0, 40);
          // console.log(
          //   `%c[BN-Stream·add·delta] accLen=${stream.accumulated.length} content_preview='${content_preview}' hasInserted=${stream.hasInserted} tempBlockId=${stream.tempBlockId}`,
          //   'color:#f59e0b',
          // );

          // If we haven't inserted the temporary block yet, insert it at the final position
          if (!stream.hasInserted) {
            const insertAt = stream.insertAt || null;
            const blockId = stream.targetBlockId || null;
            const position = stream.position || 'after';

            // Compare with last insert parameters to maintain chronological sequence
            const isSamePosition =
              lastInsertParamsRef.current &&
              lastInsertParamsRef.current.insertAt === insertAt &&
              lastInsertParamsRef.current.blockId === blockId &&
              lastInsertParamsRef.current.position === position;

            let finalRefBlock = blockId;
            let finalPos = position;

            if (isSamePosition && lastInsertedBlockIdRef.current) {
              let lastExists = false;
              try {
                if (editor.getBlock(lastInsertedBlockIdRef.current)) {
                  lastExists = true;
                }
              } catch (_) {}
              if (lastExists) {
                finalRefBlock = lastInsertedBlockIdRef.current;
                finalPos = 'after';
              }
            }

            const { refBlock, pos } = resolveInsertTarget(
              editor,
              finalRefBlock === blockId ? insertAt : null,
              finalRefBlock,
              finalPos,
            );

            const tempId = `temp-${toolCallId}`;
            stream.tempBlockId = tempId;

            try {
              editor.insertBlocks(
                [
                  {
                    id: tempId,
                    type: stream.blockType,
                    content: [{ type: 'text', text: cleanContent || ' ', styles: {} }],
                  },
                ],
                refBlock,
                pos,
              );
              stream.hasInserted = true;
              stream.insertedRefBlock = refBlock;
              stream.insertedPos = pos;
              // console.log(
              //   `%c[BN-Stream·add·INSERTED] tempId=${tempId} refBlock=${refBlock} pos=${pos}`,
              //   'color:#22c55e;font-weight:bold',
              // );
              // Mark the new temp block as AI-generating (pulsing left border animation)
              markGenerating(editor, [tempId]);
            } catch (err) {
              console.warn('[BN-Stream·add·INSERT-ERR]', err);
            }
          } else if (stream.tempBlockId) {
            // Update the temporary block text directly
            try {
              editor.updateBlock(stream.tempBlockId, {
                content: [{ type: 'text', text: cleanContent || ' ', styles: {} }],
              });
              // console.log(
              //   `%c[BN-Stream·add·UPDATE] tempBlockId=${stream.tempBlockId} content.len=${cleanContent.length}`,
              //   'color:#06b6d4',
              // );
            } catch (err) {
              console.warn('Realtime update failed:', err);
            }
          }
        } else if (toolName === 'update') {
          // We must collect targetBlockId and content key before doing updates
          const hasEnoughParams = stream.accumulated.includes('"content"');
          if (!hasEnoughParams) return;

          const targetId = stream.targetBlockId;
          if (targetId) {
            // Apply visual orange dashed style to old content only once
            if (!stream.hasStyledOld) {
              applyVisualUpdateOld(editor, targetId);
              scrollBlockIntoView(editor, targetId);
              stream.hasStyledOld = true;
            }

            const realTargetId = findRealBlockId(editor, targetId);
            try {
              editor.updateBlock(realTargetId, {
                content: [{ type: 'text', text: cleanContent || ' ', styles: {} }],
              });
              // Show generating animation on the target block
              markGenerating(editor, [targetId]);
            } catch (err) {
              console.warn('Realtime update of existing block failed:', err);
            }
          }
        } else if (toolName === 'delete' || toolName === 'remove') {
          // Detect if blockId is fully closed and parsed from JSON (ending with quote and comma/bracket)
          const hasEnoughParams =
            stream.accumulated.match(/"blockId"\s*:\s*"([^"]+)"\s*[,}]/) ||
            stream.accumulated.includes('}');
          if (!hasEnoughParams) return;

          const targetId = stream.targetBlockId;
          if (targetId && !stream.hasStruckThrough) {
            applyVisualStrikethrough(editor, targetId);
            scrollBlockIntoView(editor, targetId);
            stream.hasStruckThrough = true;
          }
        }
      } else if (event === 'tool-result' || event === 'tool-output-available') {
        if (finishedToolCallsRef.current.has(toolCallId)) {
          // console.log(
          //   '[useBlockNoteStreamAction] toolCallId already completed, skipping duplicate execution:',
          //   toolCallId,
          // );
          return;
        }
        finishedToolCallsRef.current.add(toolCallId);
        setTimeout(() => {
          finishedToolCallsRef.current.delete(toolCallId);
        }, 5000);
        // Stream completed! Clean up and do the final clean render with parsed Markdown / HTML
        const finalInput = input || {};
        let blockId = finalInput.blockId || finalInput.args?.blockId || stream.targetBlockId;
        if (blockId) {
          blockId = blockId.replace(/\$$/, '');
        }
        let content =
          finalInput.content ||
          finalInput.args?.content ||
          extractPartialContent(stream.accumulated) ||
          '';

        // Debug: Stream complete, finalizing block action

        if (toolName === 'add') {
          let newBlocks = [];
          try {
            if (content.trim().startsWith('<') && content.trim().endsWith('>')) {
              newBlocks = await editor.tryParseHTMLToBlocks(content);
            } else {
              newBlocks = await editor.tryParseMarkdownToBlocks(content);
            }
          } catch (err) {
            console.error('Failed to parse content as Markdown/HTML:', err);
            newBlocks = [
              { type: 'paragraph', content: [{ type: 'text', text: content, styles: {} }] },
            ];
          }

          if (newBlocks.length === 0) {
            newBlocks = [
              { type: 'paragraph', content: [{ type: 'text', text: content || ' ', styles: {} }] },
            ];
          }

          // console.log('[useBlockNoteStreamAction] Parsed newBlocks:', newBlocks);

          if (stream.tempBlockId) {
            // Update the temporary block directly instead of deleting and inserting new ones.
            // This prevents visual duplicate blocks if removeBlocks fails or lags.
            try {
              editor.updateBlock(stream.tempBlockId, {
                type: newBlocks[0].type,
                content: newBlocks[0].content,
                props: newBlocks[0].props,
              });

              const extraIds = [];
              if (newBlocks.length > 1) {
                const extras = newBlocks.slice(1).map((b) => ({ ...b, id: b.id || genId() }));
                editor.insertBlocks(extras, stream.tempBlockId, 'after');
                extras.forEach((b) => extraIds.push(b.id));
              }

              // Record last insert params and final inserted block ID
              const insertAt = finalInput.insertAt || stream.insertAt || null;
              const position = finalInput.position || stream.position || 'after';
              lastInsertParamsRef.current = { insertAt, blockId, position };
              lastInsertedBlockIdRef.current = extraIds.length > 0 ? extraIds[extraIds.length - 1] : stream.tempBlockId;

              // console.log(
              //   '[useBlockNoteStreamAction] Updated temp block instead of inserting. tempBlockId:',
              //   stream.tempBlockId,
              //   'extraCount:',
              //   extraIds.length,
              // );

              // Remove streaming indicator, then apply official highlight
              clearGenerating(editor, [stream.tempBlockId].filter(Boolean));
              highlightBlocksOfficial(editor, stream.tempBlockId, lastInsertedBlockIdRef.current);
            } catch (err) {
              console.error('[useBlockNoteStreamAction] Error updating temp block directly:', err);
            }
          } else {
            // Fallback: insert brand new blocks if no temporary block was ever created
            const insertAt = finalInput.insertAt || stream.insertAt || null;
            const position = finalInput.position || stream.position || 'after';

            // Compare with last insert parameters to maintain chronological sequence
            const isSamePosition =
              lastInsertParamsRef.current &&
              lastInsertParamsRef.current.insertAt === insertAt &&
              lastInsertParamsRef.current.blockId === blockId &&
              lastInsertParamsRef.current.position === position;

            let finalRefBlock = blockId;
            let finalPos = position;

            if (isSamePosition && lastInsertedBlockIdRef.current) {
              let lastExists = false;
              try {
                if (editor.getBlock(lastInsertedBlockIdRef.current)) {
                  lastExists = true;
                }
              } catch (_) {}
              if (lastExists) {
                finalRefBlock = lastInsertedBlockIdRef.current;
                finalPos = 'after';
              }
            }

            const { refBlock, pos } = resolveInsertTarget(
              editor,
              finalRefBlock === blockId ? insertAt : null,
              finalRefBlock,
              finalPos,
            );

            // Pre-assign IDs so we can select inserted blocks for highlight after insert
            const blocksWithIds = newBlocks.map((b) => ({ ...b, id: b.id || genId() }));

            try {
              editor.insertBlocks(blocksWithIds, refBlock, pos);
              // console.log(
              //   '[useBlockNoteStreamAction] Inserted blocks fallback. insertAt:',
              //   insertAt,
              //   'position:',
              //   pos,
              //   'refBlock:',
              //   refBlock,
              // );

              // Record last insert params and final inserted block ID
              lastInsertParamsRef.current = { insertAt, blockId, position };
              if (blocksWithIds.length > 0) {
                lastInsertedBlockIdRef.current = blocksWithIds[blocksWithIds.length - 1].id;
              }

              // Remove streaming indicator, then apply official highlight
              clearGenerating(editor, [stream.tempBlockId].filter(Boolean));
              const ids = blocksWithIds.map((b) => b.id);
              highlightBlocksOfficial(editor, ids[0], ids[ids.length - 1]);
            } catch (err) {
              console.error('[useBlockNoteStreamAction] Error inserting blocks fallback:', err);
            }
          }
        } else if (toolName === 'update' && blockId) {
          let newBlocks = [];
          try {
            if (content.trim().startsWith('<') && content.trim().endsWith('>')) {
              newBlocks = await editor.tryParseHTMLToBlocks(content);
            } else {
              newBlocks = await editor.tryParseMarkdownToBlocks(content);
            }
          } catch (err) {
            console.error('Failed to parse update content:', err);
            newBlocks = [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: content, styles: {} }],
              },
            ];
          }

          if (newBlocks.length > 0) {
            const realBlockId = findRealBlockId(editor, blockId);
            try {
              editor.updateBlock(realBlockId, {
                type: newBlocks[0].type,
                content: newBlocks[0].content,
                props: newBlocks[0].props,
              });
              const extraIds = [];
              if (newBlocks.length > 1) {
                const extras = newBlocks.slice(1).map((b) => ({ ...b, id: b.id || genId() }));
                editor.insertBlocks(extras, realBlockId, 'after');
                extras.forEach((b) => extraIds.push(b.id));
              }
              // console.log('[useBlockNoteStreamAction] Updated block successfully.');
              // Remove streaming indicator, then apply official ShowSelectionExtension highlight
              const firstId = realBlockId;
              const lastId = extraIds.length > 0 ? extraIds[extraIds.length - 1] : realBlockId;
              clearGenerating(editor, [blockId]);
              highlightBlocksOfficial(editor, firstId, lastId);
            } catch (e) {
              console.warn('Failed to update block on complete:', e);
            }
          }
        } else if ((toolName === 'delete' || toolName === 'remove') && blockId) {
          // console.log(
          //   '[useBlockNoteStreamAction] Deletion requested. toolName:',
          //   toolName,
          //   'blockId:',
          //   blockId,
          // );
          const realBlockId = findRealBlockId(editor, blockId);
          // console.log('[useBlockNoteStreamAction] Resolved realBlockId for deletion:', realBlockId);
          try {
            // Ensure visual strikethrough styling is applied
            applyVisualStrikethrough(editor, blockId);
            // Wait 400ms and trigger visual height collapse transition
            setTimeout(() => {
              try {
                const els = getBlockEls(editor, [blockId]);
                if (els.length > 0) {
                  els[0].classList.add('ai-deleting');
                  // console.log(
                  //   '[useBlockNoteStreamAction] Added class "ai-deleting" to block element',
                  // );
                } else {
                  console.warn(
                    '[useBlockNoteStreamAction] No DOM element found for height collapse using blockId:',
                    blockId,
                  );
                }
              } catch (err) {
                console.error('[useBlockNoteStreamAction] Height collapse animation error:', err);
              }
            }, 400);
            // Wait 1000ms and physically remove the block from editor
            setTimeout(() => {
              try {
                // console.log('[useBlockNoteStreamAction] Calling removeBlocks on:', realBlockId);
                editor.removeBlocks([realBlockId]);
                // console.log(
                //   `[useBlockNoteStreamAction] Deleted block successfully from editor: ${realBlockId}`,
                // );
              } catch (e) {
                console.error('[useBlockNoteStreamAction] Failed to call removeBlocks:', e);
              }
            }, 1000);
          } catch (e) {
            console.error('[useBlockNoteStreamAction] Outer delete block error:', e);
            try {
              // console.log(
              //   '[useBlockNoteStreamAction] Attempting fallback removeBlocks on:',
              //   realBlockId,
              // );
              editor.removeBlocks([realBlockId]);
            } catch (_) {}
          }
        }

        // Clean up stream buffer
        delete activeStreamsRef.current[toolCallId];
      }
    };

    resourceEventBus.on('blocknote:stream-action', handleBlockAction);
    return () => {
      resourceEventBus.off('blocknote:stream-action', handleBlockAction);
    };
  }, [editor, usageId]);
};
