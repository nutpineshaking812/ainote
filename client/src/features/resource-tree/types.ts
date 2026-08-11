export interface ResourceData {
  id: string;
  refId: string;
  type: 'document' | 'form' | 'dashboard' | 'workflow' | 'view' | string;

  title?: string;
  name?: string;
  parentId?: string | null;
  appId?: string | null;

  allowCreate?: boolean;
  allowChildren?: boolean;
  isLeaf?: boolean;
  hidden?: boolean;
  meta?: {
    docId?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface ResourceNode {
  title: string;
  key: string;
  isLeaf: boolean;
  data: ResourceData;
  parent: ResourceNode | null;
  children?: ResourceNode[];
  name?: string;
}

/**
 * Data shape returned by the resources API
 */
export interface ResourceApiDTO {
  id: string;
  refId: string;
  type: string;
  name?: string;
  title?: string;
  isLeaf?: boolean;
  hidden?: boolean;
  parentId?: string | null;
  children?: ResourceApiDTO[];
  [key: string]: any;
}

export interface CreateNodeParams {
  title?: string;
  key: string;
  isLeaf?: boolean;
  data: ResourceData;
  parent?: ResourceNode | null;
  children?: ResourceNode[];
}

export interface TreeDataOptions {
  appId?: string;
  q?: string;
}

export interface TreeDataHookResult {
  treeData: ResourceNode[];
  loading: boolean;
  loadingMap: Map<string, boolean>;
  loadChildren: (node: ResourceNode) => Promise<ResourceNode[]>;
  reloadRoots: () => void;
  reloadNode: (node: ResourceNode, createdDoc?: any) => Promise<ResourceNode[]>;
  updateDocTitle: (docId: string, newTitle: string) => void;
  addChildDoc: (parentKey: string | null, docObj: any, parentNode?: ResourceNode | null) => void;
  removeDoc: (docId: string) => void;
  setTreeFromNested: (nestedRoot: any, docId: string) => void;
  expandedKeys: string[];
  setExpandedKeys: (keys: string[]) => void;
  attachDocIdToNode: (key: string, docId: string) => void;
  moveNodeLocally: (nodeId: string, newParentId: string | null, newOrder: number) => void;
}
