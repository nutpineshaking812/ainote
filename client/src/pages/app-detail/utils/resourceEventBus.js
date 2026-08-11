import mitt from 'mitt';

/**
 * Event bus for cross-component communication in AppDetail
 * Events:
 * - resource:selected - { type, id } - A resource was selected
 * - resource:created - { type, id, data } - A resource was created
 * - resource:deleted - { type, id } - A resource was deleted
 * - resource:updated - { type, id, data } - A resource was updated
 * - tree:refresh - { nodeKey? } - Tree needs refresh (specific node or all)
 * - document:open-template-center - { trigger?, parentId? } - Request to open template center
 */
const resourceEventBus = mitt();

export default resourceEventBus;
