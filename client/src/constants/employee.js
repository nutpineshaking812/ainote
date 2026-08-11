/**
 * 数字员工场景常量定义
 */

export const EMPLOYEE_SCENARIOS = {
  GENERAL: 'GENERAL', // 通用助理
  DOCUMENT: 'DOCUMENT', // 文档协作
  VIEW_DESIGN: 'VIEW_DESIGN', // 画布与视图设计
  WORKFLOW: 'workflow', // 工作流开发
};

export const EMPLOYEE_SCENARIO_LABELS = {
  [EMPLOYEE_SCENARIOS.GENERAL]: '通用助理',
  [EMPLOYEE_SCENARIOS.DOCUMENT]: '文档协作',
  [EMPLOYEE_SCENARIOS.VIEW_DESIGN]: '画布与视图设计',
  [EMPLOYEE_SCENARIOS.WORKFLOW]: '工作流开发',
};

export const EMPLOYEE_SCENARIO_COLORS = {
  [EMPLOYEE_SCENARIOS.GENERAL]: 'blue',
  [EMPLOYEE_SCENARIOS.DOCUMENT]: 'purple',
  [EMPLOYEE_SCENARIOS.VIEW_DESIGN]: 'cyan',
  [EMPLOYEE_SCENARIOS.WORKFLOW]: 'geekblue',
};

export const EMPLOYEE_SCENARIO_OPTIONS = Object.entries(EMPLOYEE_SCENARIO_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  }),
);

export const ROLE_KEYS = [
  'CEO',
  'Product',
  'Developer',
  'QA',
  'Designer',
  'CustomerSupport',
  'Operations',
  'Copywriter',
  'DataAnalyst',
];

export const getDisplayRole = (roleTitle, t) => {
  if (!roleTitle) return '未设定角色';
  const match = ROLE_KEYS.find((k) => k.toLowerCase() === roleTitle.toLowerCase());
  if (match) {
    return t(`digitalEmployee.rolePresets.${match}`);
  }
  return roleTitle;
};

export default {
  EMPLOYEE_SCENARIOS,
  EMPLOYEE_SCENARIO_LABELS,
  EMPLOYEE_SCENARIO_COLORS,
  EMPLOYEE_SCENARIO_OPTIONS,
  ROLE_KEYS,
  getDisplayRole,
};
