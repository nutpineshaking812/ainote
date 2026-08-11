// Helper function to find department in tree
const findDeptInTree = (depts, id) => {
  for (const dept of depts) {
    if (dept.id === id) return dept;
    if (dept.children) {
      const found = findDeptInTree(dept.children, id);
      if (found) return found;
    }
  }
  return null;
};

export { findDeptInTree };
