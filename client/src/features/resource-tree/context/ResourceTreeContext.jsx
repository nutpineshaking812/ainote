import React, { createContext, useContext, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // 假设你用的是 react-router
import { useAppResources } from '../../../pages/app-detail/context/AppResourcesContext.jsx';

const ResourceTreeContext = createContext(null);

// 注意这里：加上了 { } 对 props 进行解构
export const ResourceTreeProvider = forwardRef(({ setSelectedResource, children }, ref) => {
  const navigate = useNavigate(); // 获取路由跳转方法
  const location = useLocation(); // 获取当前路径
  const { treeData } = useAppResources();

  const onSelectTree = (key, info) => {
    if (!key) return;
    const data = info?.node?.data || {};
    const rawType = data.type;
    const id = data.refId || data._id || key.split('-')[1];
    const routeType = rawType === 'document' ? 'document' : rawType;
    navigate({ pathname: location.pathname, hash: `#/${routeType}/${id}` });
    setSelectedResource({ type: routeType, id });
  };

  const navigateDocument = (docId) => {
    navigate({ pathname: location.pathname, hash: `#/document/${docId}` });
  };

  const getBreadcrumbById = (targetId) => {
    if (!targetId) return [];
    const normalizeId = (val) => (val ? String(val) : val);
    const target = normalizeId(targetId);

    const findPath = (nodes) => {
      if (!Array.isArray(nodes)) return null;
      for (const node of nodes) {
        const data = node?.data || {};
        const nodeId = normalizeId(data.id || data._id);
        const nodeRefId = normalizeId(data.refId);

        if (nodeId === target || nodeRefId === target) {
          return [node];
        }
        const childPath = findPath(node.children || []);
        if (childPath) {
          return [node, ...childPath];
        }
      }
      return null;
    };

    const pathNodes = findPath(treeData) || [];
    if (pathNodes.length === 0) {
      console.warn(
        '[ResourceTreeContext] Breadcrumb path not found for:',
        target,
        'treeSize:',
        treeData.length,
      );
    }
    return (
      pathNodes
        // .filter((n) => {
        //   const type = (n?.data || {}).type;
        //   return ['document', 'folder', 'pdf', 'form', 'view'].includes(type);
        // })
        .map((n) => {
          const d = n?.data || {};
          return {
            id: d.refId || d.id || d._id,
            title: n?.title || d.title || (d.meta && d.meta.name) || '未命名',
          };
        })
    );
  };

  const value = useMemo(
    () => ({
      onSelectTree,
      navigateDocument,
      getBreadcrumbById,
    }),
    [navigate, treeData],
  );

  useImperativeHandle(ref, () => ({
    onSelectTree,
    getBreadcrumbById,
  }));

  return <ResourceTreeContext.Provider value={value}>{children}</ResourceTreeContext.Provider>;
});

export function useResourceTree() {
  const ctx = useContext(ResourceTreeContext);
  if (!ctx) {
    throw new Error('useResourceTree must be used within ResourceTreeProvider');
  }
  return ctx;
}

export default ResourceTreeProvider;
