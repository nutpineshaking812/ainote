/**
 * Per-tool display mode mapping — SINGLE SOURCE OF TRUTH.
 *
 * This file MUST have ZERO dependencies:
 *   - AINote Agent workflow code (bundled by Temporal webpack) imports it directly.
 *   - tools/index.js re-exports it so activity / agent code can also use it.
 *
 * Possible values:
 *   'full'      — emit input-start (with args delta) + input-available (with args) + result (full data)
 *   'compact'   — emit input-start (name only) + result (with data); skip args delta/available
 *   'name-only' — emit input-start (name only); skip everything else
 */

const TOOL_DISPLAY_MODE = {
  // ── 内部查询类工具：不展示参数，只展示名称和结果 ──
  get_available_forms: 'compact',
  get_schema_by_name: 'compact',
  get_schema_by_id: 'compact',
  get_form_record_summary: 'compact',
  get_template_content: 'compact',
  get_current_time: 'name-only',
  get_chart_query_template: 'compact',

  // ── 数据查询类工具：展示完整参数和结果 (默认 full，无需列出) ──
  // execute_sql_query, explain_sql_query, executeMongoQuery, web_fetch, curl

  // ── Skill 知识类工具 ──
  read_skill: 'compact',
  read_skill_resource: 'compact',
  list_skill_resources: 'compact',
  write_skill_evolution: 'compact',

  // ── 固定流程工具 ──
  execute_workflow: 'name-only',
  save_workflow: 'compact',

  // ── 用户属性 ──
  read_user_property: 'compact',
  write_user_property: 'compact',

  // ── 文档操作 ──
  get_document: 'compact',
  create_document: 'compact',

  // ── BlockNote 编辑器 ──
  blocknote_add: 'compact',
  blocknote_update: 'compact',
  blocknote_delete: 'compact',

  // ── 休眠 ──
  sleep: 'name-only',
};

/**
 * Look up a tool's displayMode. Falls back to 'full' if not configured.
 */
export const getToolDisplayMode = (toolName) => {
  if (!toolName) return 'full';
  return TOOL_DISPLAY_MODE[toolName] || 'full';
};
