import { ResourceItem, ResourceTreeNode } from '../types';

/**
 * Build hierarchical tree from flat resource list
 *
 * @param resources Flat array of resources
 * @returns Array of root-level tree nodes
 */
export function buildResourceTree(resources: ResourceItem[]): ResourceTreeNode[] {
  // console.log('buildResourceTree', resources);
  // Create lookup maps for efficient access
  const idMap = new Map<string, ResourceItem>();
  const childrenMap = new Map<string, ResourceItem[]>();

  // Populate maps
  for (const resource of resources) {
    idMap.set(resource.id, resource);

    const parentKey = resource.parentId || 'ROOT';
    if (!childrenMap.has(parentKey)) {
      childrenMap.set(parentKey, []);
    }
    childrenMap.get(parentKey)!.push(resource);
  }

  /**
   * Helper to compare order values (handles both number and string)
   */
  const compareOrder = (a: ResourceItem, b: ResourceItem) => {
    const strA = String(a.order ?? '');
    const strB = String(b.order ?? '');
    if (strA < strB) return -1;
    if (strA > strB) return 1;
    return 0;
  };

  /**
   * Recursively build tree node
   */
  const buildNode = (resource: ResourceItem): ResourceTreeNode => {
    const rawChildren = childrenMap.get(resource.id) || [];
    const children = [...rawChildren].sort(compareOrder);

    // if (rawChildren.length > 0) {
    //   console.log(
    //     `[treeBuilder] sorted folder ${resource.meta.name}:`,
    //     children.map((c) => `${c.meta.name}(${c.order})`),
    //   );
    // }

    const hasChildren = children.length > 0;

    return {
      key: `${resource.type}-${resource.refId}`,
      title: `${resource.meta.name}`,
      data: resource,
      isLeaf: !hasChildren,
      children: hasChildren ? children.map(buildNode) : undefined,
    };
  };

  // Build tree from root level (parentId = null)
  const rootResources = (childrenMap.get('ROOT') || []).sort(compareOrder);
  // console.log(
  //   '[treeBuilder] sorted root:',
  //   rootResources.map((c) => `${c.meta.name}(${c.order})`),
  // );
  return rootResources.map(buildNode);
}

/**
 * Flatten tree back to array (for debugging/verification)
 *
 * @param nodes Tree nodes
 * @returns Flat array of resources
 */
export function flattenTree(nodes: ResourceTreeNode[]): ResourceItem[] {
  const result: ResourceItem[] = [];

  const traverse = (node: ResourceTreeNode) => {
    result.push(node.data);
    if (node.children) {
      node.children.forEach(traverse);
    }
  };

  nodes.forEach(traverse);
  return result;
}
