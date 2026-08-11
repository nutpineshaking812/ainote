/**
 * Tree manipulation utilities
 */

/**
 * Traverses the tree to find an item by key and perform a callback.
 * @param {Array} data - The tree data array.
 * @param {string|number} key - The key of the item to find.
 * @param {Function} callback - Callback function (item, index, parentArray).
 * @param {string} childrenField - The name of the children field (default: 'children').
 * @param {string} keyField - The name of the key field (default: 'key').
 */
export const findAndAction = (data, key, callback, childrenField = 'children', keyField = 'key') => {
  for (let i = 0; i < data.length; i++) {
    if (data[i][keyField] === key) {
      return callback(data[i], i, data);
    }
    if (data[i][childrenField]) {
      findAndAction(data[i][childrenField], key, callback, childrenField, keyField);
    }
  }
};

/**
 * Handles the drop logic for Ant Design Tree.
 * Returns a new tree data array.
 * 
 * @param {Object} info - The info object from antd Tree onDrop.
 * @param {Array} originalData - The current tree data.
 * @param {Object} options - Customization options.
 * @returns {Array} New tree data.
 */
export const handleTreeDrop = (info, originalData, options = {}) => {
  const { childrenField = 'children', keyField = 'key' } = options;
  const dropKey = info.node[keyField];
  const dragKey = info.dragNode[keyField];
  const dropPos = info.node.pos.split('-');
  const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]);

  const data = [...originalData];

  // Find dragObject and remove it from its original position
  let dragObj;
  findAndAction(
    data,
    dragKey,
    (item, index, arr) => {
      arr.splice(index, 1);
      dragObj = item;
    },
    childrenField,
    keyField
  );

  if (!info.dropToGap) {
    // Drop ON the node -> move into children
    findAndAction(
      data,
      dropKey,
      (item) => {
        item[childrenField] = item[childrenField] || [];
        // Insert at the beginning or end? User example uses unshift (start)
        item[childrenField].unshift(dragObj);
      },
      childrenField,
      keyField
    );
  } else {
    // Drop BETWEEN nodes
    let ar = [];
    let i;
    findAndAction(
      data,
      dropKey,
      (_item, index, arr) => {
        ar = arr;
        i = index;
      },
      childrenField,
      keyField
    );

    if (dropPosition === -1) {
      // Top of the drop node
      ar.splice(i, 0, dragObj);
    } else {
      // Bottom of the drop node
      ar.splice(i + 1, 0, dragObj);
    }
  }

  return data;
};
