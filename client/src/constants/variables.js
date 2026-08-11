/**
 * Preset system variables for form pre-filling.
 * This is the single source of truth for available variables in the UI and resolver.
 */
export const PRESET_VARIABLES = [
  { label: '当前用户姓名 ($USER_NAME)', value: '$USER_NAME' },
  { label: '当前用户 ID ($USER_ID)', value: '$USER_ID' },
  { label: '当前用户邮箱 ($USER_EMAIL)', value: '$USER_EMAIL' },
  { label: '当前组织名称 ($ORG_NAME)', value: '$ORG_NAME' },
  { label: '当前组织 ID ($ORG_ID)', value: '$ORG_ID' },
  { label: '当前页面 URL ($CURRENT_PAGE_URL)', value: '$CURRENT_PAGE_URL' },
  { label: '浏览器信息 ($BROWSER_INFO)', value: '$BROWSER_INFO' },
  { label: '当前日期 ($CURRENT_DATE)', value: '$CURRENT_DATE' },
];

export default PRESET_VARIABLES;
