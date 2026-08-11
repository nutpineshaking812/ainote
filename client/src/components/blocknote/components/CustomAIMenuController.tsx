import {
  BlockPopover,
  FloatingUIOptions,
  useBlockNoteEditor,
  useExtension,
  useExtensionState,
} from '@blocknote/react';
import { FC, useMemo } from 'react';
import { autoUpdate, offset, size, flip, shift } from '@floating-ui/react';

import {
  getDefaultAIMenuItems,
  AIMenuSuggestionItem,
  getAIDictionary,
  AIExtension,
  aiDocumentFormats,
} from '@blocknote/xl-ai';

import { CustomAIMenu, CustomAIMenuProps } from './CustomAIMenu';

export const CustomAIMenuController = (props: {
  aiMenu?: FC<CustomAIMenuProps>;
  customPlaceholder?: string;
}) => {
  const editor = useBlockNoteEditor();
  const ai = useExtension(AIExtension);
  // console.log("CustomAIMenuController render");

  const aiMenuState = useExtensionState(AIExtension, {
    editor,
    selector: (state) => state.aiMenuState,
  });

  const blockId = aiMenuState === 'closed' ? undefined : aiMenuState.blockId;

  const Component = props.aiMenu || CustomAIMenu;

  const floatingUIOptions = useMemo<FloatingUIOptions>(
    () => ({
      useFloatingOptions: {
        open: aiMenuState !== 'closed',
        placement: 'bottom',
        middleware: [
          offset(10),
          flip(),
          shift(),
          size({
            apply({ rects, elements }) {
              Object.assign(elements.floating.style, {
                width: `${rects.reference.width}px`,
              });
            },
          }),
        ],
        onOpenChange: (open) => {
          if (open || aiMenuState === 'closed') {
            return;
          }

          if (aiMenuState.status === 'user-input') {
            ai.closeAIMenu();
          } else if (aiMenuState.status === 'user-reviewing' || aiMenuState.status === 'error') {
            ai.rejectChanges();
          }
        },
        whileElementsMounted(reference, floating, update) {
          return autoUpdate(reference, floating, update, {
            animationFrame: true,
          });
        },
      },
      useDismissProps: {
        enabled: aiMenuState === 'closed' || aiMenuState.status === 'user-input',
        // We should just be able to set `referencePress: true` instead of
        // using this listener, but this doesn't seem to trigger.
        // (probably because we don't assign the referenceProps to the reference element)
        outsidePress: (event) => {
          if (event.target instanceof Element) {
            const blockElement = event.target.closest('.bn-block');
            if (blockElement && blockElement.getAttribute('data-id') === blockId) {
              ai.closeAIMenu();
            }
          }

          return true;
        },
      },
      elementProps: {
        style: {
          zIndex: 100,
        },
      },
      ...props.floatingUIOptions,
    }),
    [ai, aiMenuState, blockId, props.floatingUIOptions],
  );

  return (
    <BlockPopover blockId={blockId} {...floatingUIOptions}>
      {aiMenuState !== 'closed' && <Component />}
    </BlockPopover>
  );
};
