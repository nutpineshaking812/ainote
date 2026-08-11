import { Extension } from '@tiptap/core';
import { getBlocksChangedByTransaction } from '@blocknote/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const preventEditByIdPlugin = (protectedBlockIds, shouldProtect) => {
  return new Plugin({
    key: new PluginKey('blockProtection'),
    filterTransaction: (tr) => {
      // 如果事务没有改变文档，直接允许
      if (!tr.docChanged) {
        return true;
      }
      // 获取受影响的 blocks
      // const changes = getBlocksChangedByTransaction(tr);
      // // 检查是否有受保护的 block 被修改
      // const hasProtectedChange = changes.some(change => {
      //   const isProtected = protectedBlockIds.includes(change.block.id);
      //   // 使用自定义保护逻辑或默认逻辑
      //   if (shouldProtect) {
      //     return isProtected && shouldProtect(change.block.id, change.type);
      //   }
      //   return isProtected;
      // });
      // // 如果有受保护的 block 被修改，阻止事务
      // return !hasProtectedChange;
      return true; // 临时阻止所有更改
    },
  });
};

export const PreventBlockFromTemplate = () => {
  return new Plugin({
    key: new PluginKey('blockProtection'),
    filterTransaction: (tr) => {
      // 如果事务没有改变文档，直接允许
      if (!tr.docChanged) {
        return true;
      }
      // 获取受影响的 blocks
      const changes = getBlocksChangedByTransaction(tr);
      // // 检查是否有受保护的 block 被修改
      const hasProtectedChange = changes.some((change) => {
        // console.log('Checking changed block:', change.block);
        return change.block?.props?.frozen === true;
      });
      return !hasProtectedChange;
    },
  });
};

export const PreventDeletionExtension = Extension.create({
  name: 'prevent_deletion',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('prevent_deletion'),
        filterTransaction: (tr, state) => {
          // console.log('PreventDeletionExtension: filterTransaction called', tr, state);
          // 性能优化：如果文档没有内容变更（只是光标移动等），直接放行
          if (!tr.docChanged) return true;

          // 🛡️ 修改此处：将 'childDocument' 加入保护列表
          const protectedTypes = ['childDocument'];

          // 1. 检查变更前，文档中存在哪些受保护的 Block ID
          const idsPresentBefore = new Set();
          state.doc.descendants((node) => {
            if (protectedTypes.includes(node.type.name)) {
              // BlockNote 的 Block 都有唯一的 ID 属性
              // console.log('Checking node before transaction:', node);
              if (node.attrs.id) {
                idsPresentBefore.add(node.attrs.id);
              }
            }
            return true; // 继续遍历
          });
          // console.log('Protected IDs before transaction:', idsPresentBefore);

          // 如果原本就没有受保护的块，那这次操作肯定没问题，放行
          if (idsPresentBefore.size === 0) return true;

          // 2. 检查变更后，这些 Block ID 是否依然存在
          const idsPresentAfter = new Set();
          tr.doc.descendants((node) => {
            if (protectedTypes.includes(node.type.name)) {
              if (node.attrs.id) {
                idsPresentAfter.add(node.attrs.id);
              }
            }
            return true;
          });

          // 3. 拦截逻辑：检查具体的 ID 是否丢失
          for (const id of idsPresentBefore) {
            if (!idsPresentAfter.has(id)) {
              console.warn(`🚫 拦截操作：禁止删除受保护的 Block (ID: ${id})`);
              return false; // 返回 false 会取消这次事务，仿佛什么都没发生
            }
          }

          return true;
        },
      }),
      // PreventBlockFromTemplate(),
      // preventEditByIdPlugin([], null)
    ];
  },
});
