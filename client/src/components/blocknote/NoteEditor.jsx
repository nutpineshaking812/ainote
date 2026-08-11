import React, {
  useImperativeHandle,
  forwardRef,
  useCallback,
  useRef,
  useState,
  useMemo,
  useEffect,
} from 'react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/xl-ai/style.css';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import './styles/editor.css';
import {
  SuggestionMenuController,
  SideMenuController,
  SideMenu,
  DragHandleButton,
  DragHandleMenu,
  BlockColorsItem,
  RemoveBlockItem,
  FormattingToolbar,
  FormattingToolbarController,
  getFormattingToolbarItems,
  useExtensionState,
  useSelectedBlocks,
} from '@blocknote/react';

import { SideMenuExtension } from '@blocknote/core/extensions';

import { AIToolbarButton, AIMenuController } from '@blocknote/xl-ai';
import { CustomAIMenu } from './components/CustomAIMenu';
import EditorTitle from './components/EditorTitle';
import useBlockNoteEditor from './hooks/useBlockNoteEditor';
import { message } from 'antd';
import { downloadFile } from '@/api/files';
import { downloadAndSave } from '@/utils/fileDownload';
import { useTranslation } from 'react-i18next';
import { RightOutlined, DownOutlined } from '@ant-design/icons';
import { CustomAIMenuController } from './components/CustomAIMenuController';

// Move nested components outside to prevent unmounting on every parent render
const CustomDragHandleMenu = (props) => (
  <DragHandleMenu {...props}>
    <RemoveBlockItem {...props}>删除</RemoveBlockItem>
    <BlockColorsItem {...props}>Colors</BlockColorsItem>
  </DragHandleMenu>
);

const FormattingToolbarWithAI = React.memo(({ editor }) => {
  return (
    <FormattingToolbarController
      formattingToolbar={() => {
        const selection = editor.getSelection();
        // const currentBlock = editor.getTextCursorPosition()?.block;
        // console.log('currentBlock', currentBlock, selection);
        return (
          <FormattingToolbar>
            {getFormattingToolbarItems()}
            {selection && selection.length > 0 && <AIToolbarButton />}
          </FormattingToolbar>
        );
      }}
      floatingOptions={{
        nodeId: 'floating-formatting-toolbar',
        element: {},
      }}
    />
  );
});

const NoteEditor = forwardRef(
  (
    {
      appId,
      initialTitle = '',
      title,
      placeholderTitle = '点击输入标题',
      onTitleChange,
      initialBlocks = [],
      onChange,
      withTitle = false,
      height = '100%',
      readOnly = false,
      originalFileInfo = {},
      childDocs = [],
      showAIUI = true,
      titleSlot, // A React node to render below the title (e.g., tags + updatedAt)
      usageType,
      usageId,
    },
    ref,
  ) => {
    const editorRef = useRef(null);

    // 修复：拦截 BlockNote 写入剪贴板的 HTML，只去掉 heading 上
    // 的 data-level 属性，避免钉钉将其误解为列表标记（黑色方块）
    const handleCopyFix = useCallback((e) => {
      const cd = e.clipboardData;
      if (!cd) return;
      const originalSetData = cd.setData.bind(cd);
      cd.setData = function (type, data) {
        if (type === 'text/html' && typeof data === 'string') {
          data = data.replace(/(<h[1-6])\s+data-level\s*=\s*["'][^"']*["']/gi, '$1');
        }
        return originalSetData(type, data);
      };
    }, []);

    // 捕获阶段监听，在 BlockNote 调用 setData 之前完成拦截
    useEffect(() => {
      document.addEventListener('copy', handleCopyFix, true);
      return () => document.removeEventListener('copy', handleCopyFix, true);
    }, [handleCopyFix]);

    const {
      editor,
      exportToMarkdown,
      onChangeCallback,
      slashGetItems,
      mentionGetItems,
      customAIMenuItems,
      showSlashMenu,
    } = useBlockNoteEditor({
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
    });
    const { t } = useTranslation();
    const [isSlotExpanded, setIsSlotExpanded] = useState(true);

    useImperativeHandle(ref, () => ({
      exportToMarkdown,
    }));

    // Focus the editor when Enter is pressed in the title
    const handleTitleEnter = useCallback(() => {
      if (!editor) return;
      try {
        editor.focus();
        const blocks = editor.document;
        if (!blocks || blocks.length === 0) return;

        const firstBlock = blocks[0];

        // If first block is already an empty paragraph, just move cursor there
        const isEmptyParagraph =
          firstBlock.type === 'paragraph' &&
          (!firstBlock.content ||
            firstBlock.content.length === 0 ||
            (firstBlock.content.length === 1 &&
              firstBlock.content[0].type === 'text' &&
              firstBlock.content[0].text === ''));

        if (isEmptyParagraph) {
          editor.setTextCursorPosition(firstBlock.id, 'start');
        } else {
          // Insert a new empty paragraph before the first block
          editor.insertBlocks([{ type: 'paragraph', content: [] }], firstBlock.id, 'before');
          // Now the new block is the first one - focus it
          const updatedBlocks = editor.document;
          if (updatedBlocks?.length > 0) {
            editor.setTextCursorPosition(updatedBlocks[0].id, 'start');
          }
        }
      } catch (e) {
        // ignore
      }
    }, [editor]);

    return (
      <div
        className="blocknote-editor-wrapper"
        style={{
          height: typeof height === 'string' ? height : `${height}px`,
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          // overflowY: 'auto',
        }}
      >
        {/* Single content area — scrolling is controlled by the parent */}
        <div style={{ flex: 1, minHeight: 0 }} ref={editorRef}>
          {/* External Title (not a BlockNote block) */}
          {withTitle && (
            <div className="blocknote-title-area">
              <EditorTitle
                value={title ?? initialTitle}
                onChange={onTitleChange}
                onEnter={handleTitleEnter}
                placeholder={placeholderTitle}
                readOnly={readOnly}
              />
              {/* titleSlot: tags, updatedAt, etc. */}
              {titleSlot && (
                <div className={`blocknote-title-slot ${!isSlotExpanded ? 'is-collapsed' : ''}`}>
                  {isSlotExpanded && <div style={{ marginBottom: '0px' }}>{titleSlot}</div>}
                  {/* <div
                    className="blocknote-title-slot-toggle"
                    onClick={() => setIsSlotExpanded(!isSlotExpanded)}
                  >
                    <span className="toggle-text">
                      {isSlotExpanded ? t('common.hideDetails') : t('common.showDetails')}
                    </span>
                  </div> */}
                </div>
              )}
            </div>
          )}

          {/* BlockNote editor body */}
          <BlockNoteView
            key={'blocknote-editor'}
            editor={editor}
            editable={!readOnly}
            tableHandles={true}
            onChange={onChangeCallback}
            slashMenu={false}
            sideMenu={false}
            theme={'light'}
            formattingToolbar={false}
            autoFocus={false}
          >
            {showAIUI && (
              <CustomAIMenuController>
                <CustomAIMenu items={customAIMenuItems} />
              </CustomAIMenuController>
            )}

            {showAIUI && <FormattingToolbarWithAI editor={editor} />}

            {showSlashMenu && (
              <SuggestionMenuController triggerCharacter="/" getItems={slashGetItems} />
            )}

            {mentionGetItems && (
              <>
                <SuggestionMenuController triggerCharacter="@" getItems={mentionGetItems} />
                <SuggestionMenuController triggerCharacter="@doc:" getItems={mentionGetItems} />
                <SuggestionMenuController triggerCharacter="@tool:" getItems={mentionGetItems} />
                <SuggestionMenuController triggerCharacter="@form:" getItems={mentionGetItems} />
                <SuggestionMenuController triggerCharacter="@view:" getItems={mentionGetItems} />
                <SuggestionMenuController triggerCharacter="@mcp:" getItems={mentionGetItems} />
              </>
            )}

            {showAIUI && (
              <SideMenuController
                sideMenu={(props) => {
                  const state = useExtensionState(SideMenuExtension, {
                    selector: (state) => {
                      return state !== undefined
                        ? {
                            show: state.show,
                            block: state.block,
                          }
                        : undefined;
                    },
                  });
                  const { show, block } = state || {};
                  if (!block) return null;
                  return (
                    <SideMenu {...props}>
                      <DragHandleButton {...props} dragHandleMenu={CustomDragHandleMenu} />
                    </SideMenu>
                  );
                }}
              />
            )}
          </BlockNoteView>
        </div>
      </div>
    );
  },
);

export default React.memo(NoteEditor);
