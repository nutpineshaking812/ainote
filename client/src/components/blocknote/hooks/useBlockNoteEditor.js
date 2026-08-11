import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCreateBlockNote, getDefaultReactSlashMenuItems } from '@blocknote/react';
import { zh } from '@blocknote/core/locales';
import { zh as aiEn } from '@blocknote/xl-ai/locales';
import {
  AIExtension,
  aiDocumentFormats,
  getDefaultAIMenuItems,
  getAISlashMenuItems,
} from '@blocknote/xl-ai';
import { buildInitialContent } from '@shared/blocknote';
import { uploadAttachment } from '../../../api/upload';
import { buildGeneralTransport } from '../utils/Transport';
import { PreventDeletionExtension } from '../plugins/PreventDeletionExtension.jsx';
import { customSchema } from '../blocks/index.ts';
import { resourceCache } from '../../../lib/resource-cache/ResourceCache';
import { getSkills, getSystemSkills } from '../../../api/skills';
import resourceEventBus from '../../../pages/app-detail/utils/resourceEventBus.js';

import { useBlockNoteStreamAction } from './useBlockNoteStreamAction.js';

const useBlockNoteEditor = ({
  appId,
  initialTitle,
  placeholderTitle,
  initialBlocks,
  onChange,
  onTitleChange,
  withTitle,
  originalFileInfo,
  childDocs,
  usageType,
  usageId,
}) => {
  const [showSlashMenu, setShowSlashMenu] = useState(true);
  const [systemTools, setSystemTools] = useState([]);
  const [mcpSkills, setMcpSkills] = useState([]);
  const syncTimerRef = useRef(null);

  const lastTitleRef = useRef(initialTitle);
  const lastBlocksRef = useRef(JSON.stringify(initialBlocks || []));

  useEffect(() => {
    const loadSystemTools = async () => {
      try {
        const res = await getSystemSkills({ page: 1, limit: 100 });
        setSystemTools(res.list || []);
      } catch (err) {
        console.error('Failed to load system tools', err);
      }
    };
    loadSystemTools();
  }, []);

  useEffect(() => {
    if (!appId) return;
    const loadMcpSkills = async () => {
      try {
        const res = await getSkills({ appId });
        const skills = Array.isArray(res) ? res : res?.list || [];
        const mcps = skills.filter((s) => s.type === 'MCP');
        setMcpSkills(mcps);
      } catch (err) {
        console.error('Failed to load MCP skills', err);
      }
    };
    loadMcpSkills();
  }, [appId]);

  const handleUpload = useCallback(
    async (file) => {
      try {
        const result = await uploadAttachment(file, { usageType, usageId });
        return result.url;
      } catch (error) {
        console.error('Upload failed:', error);
        throw error;
      }
    },
    [usageType, usageId],
  );

  const schema = customSchema;

  const customTool = useMemo(
    () => ({
      name: 'customAction',
      description: '执行自定义操作',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string' },
        },
        required: ['action'],
      },
      validate: (operation) => {
        if (operation.type !== 'customAction') {
          return { ok: false, error: 'Invalid operation type' };
        }
        if (!operation.action) {
          return { ok: false, error: 'Missing action parameter' };
        }
        return { ok: true, value: operation };
      },
      executor: () => ({
        execute: async (chunk) => {
          if (chunk.operation.type !== 'customAction') {
            return false;
          }
          if (chunk.isPossiblyPartial) {
            return true;
          }
          console.log('执行自定义操作:', chunk);
          return true;
        },
      }),
    }),
    [],
  );

  const customStreamToolsProvider = useMemo(
    () => ({
      getStreamTools: (editor, selectionInfo, onBlockUpdate) => {
        const defaultTools = aiDocumentFormats.html
          .getStreamToolsProvider({
            defaultStreamTools: {
              add: true,
              update: true,
              delete: true,
            },
          })
          .getStreamTools(editor, selectionInfo, onBlockUpdate);

        return [...defaultTools, customTool];
      },
    }),
    [customTool],
  );

  const initialContent = useMemo(
    () =>
      buildInitialContent(
        initialTitle,
        initialBlocks,
        childDocs,
        originalFileInfo,
        placeholderTitle,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // NOTE: intentionally only run on mount (initialTitle/initialBlocks are stable refs from parent)
    [],
  );

  const extensions = useMemo(
    () => [
      AIExtension({
        transport: buildGeneralTransport({ targetId: usageId, scenario: 'DOCUMENT' }),
        streamToolsProvider: customStreamToolsProvider,
      }),
    ],
    [customStreamToolsProvider, usageId],
  );

  const editor = useCreateBlockNote({
    dictionary: useMemo(
      () => ({
        ...zh,
        ai: aiEn,
      }),
      [],
    ),
    tables: {
      splitCells: true,
      cellBackgroundColor: true,
      cellTextColor: true,
      headers: true,
    },
    schema,
    uploadFile: handleUpload,
    _tiptapOptions: {
      extensions: [PreventDeletionExtension],
      editorProps: {
        handleDOMEvents: {
          blur: () => false,
          focus: () => false,
        },
      },
      onMount: () => {
        const blocks = editor.document;
        const firstTextBlock = blocks.find((b) => b.type !== 'divider');
        if (firstTextBlock) {
          editor.setTextCursorPosition(firstTextBlock.id, 'start');
        }
        editor._tiptapEditor?.commands.blur();

        // Hack to prevent SuggestionMenu from closing during Chinese IME composition
        const tiptap = editor._tiptapEditor;
        if (tiptap && tiptap.state && tiptap.state.plugins) {
          const plugin = tiptap.state.plugins.find((p) => {
            return p.key && typeof p.key === 'string' && p.key.includes('SuggestionMenuPlugin');
          });

          if (plugin) {
            const makeWrappedApply = (originalApply) => {
              return function (tr, value, oldState, newState) {
                const isComposing = tiptap.view?.composing;
                if (isComposing && value !== undefined) {
                  const mockedNewState = new Proxy(newState, {
                    get(target, prop, receiver) {
                      if (prop === 'selection') {
                        return {
                          from: target.selection.from,
                          to: target.selection.from,
                          $from: target.selection.$from,
                          $to: target.selection.$from,
                          sameParent: (pos) => target.selection.$from.sameParent(pos),
                        };
                      }
                      return Reflect.get(target, prop, receiver);
                    },
                  });
                  return originalApply.call(this, tr, value, oldState, mockedNewState);
                }
                return originalApply.call(this, tr, value, oldState, newState);
              };
            };

            // 1. Wrap the spec.state.apply method (for completeness)
            if (plugin.spec && plugin.spec.state && typeof plugin.spec.state.apply === 'function') {
              plugin.spec.state.apply = makeWrappedApply(plugin.spec.state.apply);
            }

            // 2. Wrap the compiled StateField apply method (which is what ProseMirror actually calls!)
            const fields = tiptap.state.config?.fields;
            if (Array.isArray(fields)) {
              const field = fields.find((f) => {
                return (
                  f.name === plugin.key ||
                  (f.name && typeof f.name === 'string' && f.name.includes('SuggestionMenuPlugin'))
                );
              });
              if (field && typeof field.apply === 'function') {
                field.apply = makeWrappedApply(field.apply);
              }
            }
          }
        }

        // Wrap closeMenu to prevent auto-closing when typing query with 0 matches (Xt hook behavior)
        const suggestionMenu =
          typeof editor.getExtension === 'function' ? editor.getExtension('suggestionMenu') : null;
        if (suggestionMenu && typeof suggestionMenu.closeMenu === 'function') {
          const originalCloseMenu = suggestionMenu.closeMenu;

          let isLegitimateClose = false;
          const triggerLegitimateClose = () => {
            isLegitimateClose = true;
            setTimeout(() => {
              isLegitimateClose = false;
            }, 0);
          };

          const cleanups = [];

          const handleMouseDown = () => triggerLegitimateClose();
          const handleBlur = () => triggerLegitimateClose();
          const handleKeyDown = (e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === 'Tab') {
              triggerLegitimateClose();
            }
          };

          window.addEventListener('mousedown', handleMouseDown, true);
          window.addEventListener('blur', handleBlur, true);
          window.addEventListener('keydown', handleKeyDown, true);

          cleanups.push(() => window.removeEventListener('mousedown', handleMouseDown, true));
          cleanups.push(() => window.removeEventListener('blur', handleBlur, true));
          cleanups.push(() => window.removeEventListener('keydown', handleKeyDown, true));

          suggestionMenu.closeMenu = function () {
            if (!isLegitimateClose) {
              return;
            }
            return originalCloseMenu.apply(this, arguments);
          };

          editor._closeMenuCleanups = cleanups;
        }
      },
      onUnmount: () => {
        if (editor && editor._closeMenuCleanups) {
          editor._closeMenuCleanups.forEach((fn) => fn());
        }
      },
    },
    extensions,
    initialContent,
    pasteHandler: ({ event, editor, defaultPasteHandler }) => {
      const vscode = event.clipboardData?.getData('vscode-editor-data');
      if (vscode) {
        try {
          const vscodeData = JSON.parse(vscode);
          const text = event.clipboardData.getData('text/plain');
          if (text) {
            const trimmed = text.trim();
            const mode = vscodeData?.mode;
            const isMarkdown =
              mode === 'markdown' ||
              trimmed.startsWith('```') ||
              /^#+\s/m.test(trimmed) ||
              /^[-*+]\s/m.test(trimmed);

            if (isMarkdown) {
              try {
                editor.pasteMarkdown(text);
              } catch (err) {
                console.error("Failed to paste markdown, falling back to pasteText:", err);
                editor.pasteText(text);
              }
              return true;
            } else if (mode && mode !== 'plaintext') {
              let language = 'javascript';
              const m = mode.toLowerCase();
              if (m === 'typescript' || m === 'ts') language = 'typescript';
              else if (m === 'javascript' || m === 'js') language = 'javascript';
              else if (m === 'python' || m === 'py') language = 'python';
              else if (m === 'json') language = 'json';
              else if (m === 'sql') language = 'sql';
              else if (m === 'bash' || m === 'sh' || m === 'shellscript') language = 'bash';
              else if (m === 'mermaid') language = 'mermaid';

              const pos = editor?.getTextCursorPosition?.();
              const currentBlock = pos?.block;
              
              if (currentBlock) {
                const isEmpty = !currentBlock.content || currentBlock.content.length === 0 || 
                  (currentBlock.content.length === 1 && currentBlock.content[0].text === '');

                if (isEmpty) {
                  editor.updateBlock(currentBlock.id, {
                    type: 'codeBlock',
                    props: { language },
                    content: [{ type: 'text', text: text }],
                  });
                  // 强制将光标聚焦至新升级的代码块内，同步 ProseMirror 选区，保证拖放和状态管理正常
                  setTimeout(() => {
                    try {
                      editor.setTextCursorPosition(currentBlock.id, 'end');
                    } catch (e) {
                      console.warn('[useBlockNoteEditor] failed to set cursor after updateBlock:', e);
                    }
                  }, 50);
                } else {
                  const inserted = editor.insertBlocks([
                    {
                      type: 'codeBlock',
                      props: { language },
                      content: [{ type: 'text', text: text }],
                    }
                  ], currentBlock, 'after');
                  
                  // 强制将光标聚焦至新插入的代码块内，同步 ProseMirror 选区，保证拖放和状态管理正常
                  if (inserted && inserted.length > 0) {
                    const newBlock = inserted[0];
                    setTimeout(() => {
                      try {
                        editor.setTextCursorPosition(newBlock.id, 'end');
                      } catch (e) {
                        console.warn('[useBlockNoteEditor] failed to set cursor after insertBlocks:', e);
                      }
                    }, 50);
                  }
                }
              } else {
                const inserted = editor.insertBlocks([
                  {
                    type: 'codeBlock',
                    props: { language },
                    content: [{ type: 'text', text: text }],
                  }
                ]);
                if (inserted && inserted.length > 0) {
                  const newBlock = inserted[0];
                  setTimeout(() => {
                    try {
                      editor.setTextCursorPosition(newBlock.id, 'end');
                    } catch (e) {
                      console.warn('[useBlockNoteEditor] failed to set cursor after fallback insertBlocks:', e);
                    }
                  }, 50);
                }
              }
              return true;
            }
          }
        } catch (e) {
          console.error('[VSCode paste handler error]', e);
        }
      }
      return defaultPasteHandler();
    },
  });

  const exportToMarkdown = useCallback(
    async (pure = false) => {
      if (!editor) return '';
      let blocks = editor.document;
      if (pure) {
        blocks = blocks.filter((block) => block.type !== 'childDocument');
      }
      return editor.blocksToMarkdownLossy(blocks);
    },
    [editor],
  );

  const onChangeCallback = useCallback(
    (editorInstance) => {
      if (!onChange) return;
      if (!editorInstance) return;
      const allBlocks = editorInstance.document;
      if (!allBlocks) return;

      const serialized = JSON.stringify(allBlocks);
      if (serialized !== lastBlocksRef.current) {
        lastBlocksRef.current = serialized;

        // Use a ref to debounce outward sync
        if (syncTimerRef.current) {
          clearTimeout(syncTimerRef.current);
        }
        syncTimerRef.current = setTimeout(() => {
          console.info('[useBlockNoteEditor] Debounced onChange sync triggered');
          onChange(allBlocks);
        }, 500);
      }
    },
    [onChange],
  );

  const slashGetItems = useCallback(
    async (query) => {
      if (!editor) return [];
      try {
        const pos = editor?.getTextCursorPosition?.();
        const currentBlock = pos?.block;
        if (!currentBlock) return [];
        if (currentBlock.props?.noSlash) return [];
        const baseItems = getDefaultReactSlashMenuItems(editor);
        const aiItems = getAISlashMenuItems(editor);
        const items = [...aiItems, ...baseItems];
        const q = (query || '').toLowerCase();
        return items.filter((item) =>
          (item.aliases || []).some((alias) => alias.toLowerCase().includes(q)),
        );
      } catch (error) {
        console.error('slash menu getItems error', error);
        return [];
      }
    },
    [editor],
  );

  const mentionGetItems = useCallback(
    async (query) => {
      if (!editor) return [];

      const suggestionMenu =
        typeof editor.getExtension === 'function' ? editor.getExtension('suggestionMenu') : null;
      const triggerChar = suggestionMenu?.store?.state?.triggerCharacter;

      try {
        const q = (query || '').toLowerCase();

        // 1. Fetch resources from cache
        const cachedResources = appId ? await resourceCache.getFromCache(appId) : [];

        let documents = (cachedResources || [])
          .filter((r) => r.type === 'document')
          .map((r) => ({
            _id: r.refId,
            title: r.meta?.name || '未命名文档',
            type: 'document',
          }));

        // Merge with childDocs passed to editor (removing duplicates)
        if (childDocs && childDocs.length > 0) {
          const docIds = new Set(documents.map((d) => String(d._id)));
          childDocs.forEach((c) => {
            if (!docIds.has(String(c._id))) {
              documents.push({
                _id: c._id,
                title: c.title || '未命名文档',
                type: 'document',
              });
            }
          });
        }

        // Exclude the current document itself to avoid circular reference
        if (usageId) {
          documents = documents.filter((d) => d._id !== usageId);
        }

        const forms = (cachedResources || [])
          .filter((r) => r.type === 'form')
          .map((r) => ({
            _id: r.refId,
            title: r.meta?.name || '未命名表单',
            type: 'form',
          }));

        const views = (cachedResources || [])
          .filter((r) => r.type === 'view')
          .map((r) => ({
            _id: r.refId,
            title: r.meta?.name || '未命名视图',
            type: 'view',
          }));

        const tools = systemTools.map((t) => ({
          _id: t.id,
          title: t.name,
          type: 'tool',
        }));

        const mcps = mcpSkills.map((s) => ({
          _id: s.id,
          title: s.name || s.label || '未命名插件',
          type: 'mcp',
        }));

        // 2. Determine active category based on active triggerCharacter
        let filterCategory = null;
        let searchKeyword = q;

        if (triggerChar === '@doc:') {
          filterCategory = 'document';
        } else if (triggerChar === '@tool:') {
          filterCategory = 'tool';
        } else if (triggerChar === '@form:') {
          filterCategory = 'form';
        } else if (triggerChar === '@view:') {
          filterCategory = 'view';
        } else if (triggerChar === '@mcp:') {
          filterCategory = 'mcp';
        } else {
          // Fallback parsing for manual input (e.g. typing @doc: directly under trigger "@")
          if (q.startsWith('doc:')) {
            filterCategory = 'document';
            searchKeyword = q.substring(4);
          } else if (q.startsWith('tool:')) {
            filterCategory = 'tool';
            searchKeyword = q.substring(5);
          } else if (q.startsWith('form:')) {
            filterCategory = 'form';
            searchKeyword = q.substring(5);
          } else if (q.startsWith('view:')) {
            filterCategory = 'view';
            searchKeyword = q.substring(5);
          } else if (q.startsWith('mcp:')) {
            filterCategory = 'mcp';
            searchKeyword = q.substring(4);
          }
        }

        // 3. Return category switcher if query is empty and no category is active
        if (q === '' && !filterCategory) {
          const triggerMenuOpen = (trigger) => {
            setTimeout(() => {
              if (suggestionMenu && typeof suggestionMenu.openSuggestionMenu === 'function') {
                suggestionMenu.openSuggestionMenu(trigger, {
                  deleteTriggerCharacter: true,
                  ignoreQueryLength: true,
                });
              }
            }, 50);
          };

          return [
            {
              title: '文档 (Documents)',
              onItemClick: () => {
                triggerMenuOpen('@doc:');
              },
            },
            {
              title: '系统工具 (Tools)',
              onItemClick: () => {
                triggerMenuOpen('@tool:');
              },
            },
            {
              title: '表单 (Forms)',
              onItemClick: () => {
                triggerMenuOpen('@form:');
              },
            },
            {
              title: '视图 (Views)',
              onItemClick: () => {
                triggerMenuOpen('@view:');
              },
            },
            {
              title: '外部插件 (MCP)',
              onItemClick: () => {
                triggerMenuOpen('@mcp:');
              },
            },
          ];
        }

        // 4. Filter candidates
        let candidates = [];
        if (filterCategory) {
          if (filterCategory === 'document') candidates = documents;
          else if (filterCategory === 'tool') candidates = tools;
          else if (filterCategory === 'form') candidates = forms;
          else if (filterCategory === 'view') candidates = views;
          else if (filterCategory === 'mcp') candidates = mcps;
        } else {
          candidates = [...documents, ...tools, ...forms, ...views, ...mcps];
        }

        const seenTitles = new Set();
        const filtered = candidates
          .filter((c) => (c.title || '').toLowerCase().includes(searchKeyword))
          .filter((c) => {
            const t = c.title || '';
            if (seenTitles.has(t)) return false;
            seenTitles.add(t);
            return true;
          });

        const typeLabels = {
          document: '文档',
          form: '表单',
          view: '视图',
          tool: '系统工具',
          mcp: '外部插件',
        };

        return filtered.map((c) => ({
          title: c.title,
          subtext: typeLabels[c.type] || c.type,
          onItemClick: () => {
            editor.insertInlineContent([
              {
                type: 'docMention',
                props: {
                  docId: c._id,
                  title: c.title,
                  type: c.type,
                },
              },
              ' ',
            ]);
          },
        }));
      } catch (error) {
        console.error('mention menu getItems error', error);
        return [];
      }
    },
    [editor, appId, childDocs, usageId, systemTools, mcpSkills],
  );

  const customAIMenuItems = useCallback((editorInstance) => {
    if (!editorInstance) return [];
    return [...getDefaultAIMenuItems(editorInstance)];
  }, []);

  // useEffect(() => {
  //   if (editor) {
  //     setTimeout(() => {
  //       try {
  //         // 方案 A: 如果你想把选中状态强行清除，最有效的是直接 blur
  //         // editor._tiptapEditor?.commands.blur();
  //         // 方案 B: 或者强行让它去做一次空的 Text Selection (这会自动清除 Node Selection)
  //         editor._tiptapEditor?.commands.setTextSelection(0);
  //         console.info('[useBlockNoteEditor] Initial selection cleared');
  //       } catch (e) {
  //         console.warn('Initial deselect failed', e);
  //       }
  //     }, 50); // 稍微延长一点时间，确保 Tiptap 内部逻辑执行完
  //   }
  // }, [editor]);

  // const autoFocus = useCallback(() => {
  //   if (!editor) return;
  //   const rawBlocks = editor.document;
  //   const blocks = rawBlocks.filter(
  //     (b) => (b.content && b.content.length > 0) || (b.children && b.children.length > 0),
  //   );
  //   if (blocks.length === 1) {
  //     editor.focus();
  //     if (rawBlocks.length === 1) {
  //       const firstBlock = rawBlocks[0];
  //       editor.setTextCursorPosition(firstBlock.id, 'end');
  //     } else {
  //       const firstBlock = rawBlocks[1];
  //       editor.setTextCursorPosition(firstBlock.id, 'end');
  //     }
  //   }
  // }, [editor]);

  // const scrollToCursor = useCallback(() => {
  //   if (!editor) return;
  //   try {
  //     const pos = editor.getTextCursorPosition();
  //     if (!pos?.block) return;

  //     const blockId = pos.block.id;
  //     // 使用 editor._tiptapEditor.view.dom 限定查找范围
  //     const editorDom = editor._tiptapEditor?.view?.dom;
  //     if (!editorDom) return;

  //     const blockElement = editorDom.querySelector(`[data-id="${blockId}"]`);
  //     if (blockElement) {
  //       blockElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  //     }
  //   } catch (e) {
  //     console.error('Auto-scroll failed:', e);
  //   }
  // }, [editor]);

  // useEffect(() => {
  //   if (!editor) return;
  //   setTimeout(() => {
  //     autoFocus();
  //   }, 0);

  //   const update = () => {
  //     try {
  //       const pos = editor.getTextCursorPosition?.();
  //       const type = pos?.block?.type;
  //       const noSlash = pos?.block?.props?.noSlash;
  //       // setShowSlashMenu(!noSlash);
  //     } catch (error) {
  //       // setShowSlashMenu(true);
  //     }
  //   };

  //   const unsubscribe = editor.onChange(() => {
  //     console.debug('[useBlockNoteEditor] editor.onChange event');
  //     setTimeout(() => {
  //       update();
  //       scrollToCursor();
  //     }, 0);
  //   });

  //   update();

  //   return unsubscribe;
  // }, [editor, autoFocus]);

  useBlockNoteStreamAction(editor, usageId);

  return {
    editor,
    exportToMarkdown,
    onChangeCallback,
    slashGetItems,
    mentionGetItems,
    customAIMenuItems,
    showSlashMenu,
  };
};

export default useBlockNoteEditor;
