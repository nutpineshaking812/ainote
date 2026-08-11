// 工具注册统一入口
// 工具注册统一入口
import { getAvailableForms } from './builtins/get_available_forms.js';
import { getSchemaByName } from './builtins/get_schema_by_name.js';
import { getSchemaById } from './builtins/get_schema_by_id.js';

import { executeSqlQuery } from './builtins/execute_sql_query.js';
import { explainSqlQuery } from './builtins/explain_sql_query.js';
import { getChartQueryTemplate } from './builtins/get_chart_query_template.js';
import { getFormRecordSummary } from './builtins/get_form_record_summary.js';
import { getTemplateContent } from './builtins/get_template_content.js';
import {
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
} from './builtins/get_document.js';
import {
  readSkill,
  readSkillResource,
  listSkillResources,
  writeSkillEvolution,
} from './builtins/read_skill.js';
import { getCurrentTimeTool } from './builtins/get_current_time.js';
import { webFetchTool } from './builtins/web_fetch.js';
import { curlTool } from './builtins/curl.js';
import { executeWorkflow } from './builtins/execute_workflow.js';
import { saveWorkflow } from './builtins/save_workflow.js';
import { readUserProperty, writeUserProperty } from './builtins/user_property.js';
import {
  blocknoteAdd,
  blocknoteUpdate,
  blocknoteDelete,
} from './builtins/blocknote_tools.js';

import { sleepTool } from './builtins/sleep.js';

import { z } from 'zod';

// Aggregate tools dictionary (Not exported outside, strictly managed internally)
const toolsArray = [
  getAvailableForms,
  getSchemaByName,
  getSchemaById,
  executeSqlQuery,
  explainSqlQuery,
  getFormRecordSummary,

  getChartQueryTemplate,


  getTemplateContent,
  getDocument,
  readSkill,
  readSkillResource,
  listSkillResources,
  writeSkillEvolution,
  getCurrentTimeTool,
  webFetchTool,
  curlTool,
  executeWorkflow,
  saveWorkflow,
  readUserProperty,
  writeUserProperty,
  createDocument,
  sleepTool,
  blocknoteAdd,
  blocknoteUpdate,
  blocknoteDelete,
  // updateDocument,
  // deleteDocument,
];

const tools = toolsArray.reduce((acc, tool) => {
  if (tool && tool.name) {
    acc[tool.name] = tool;
  }
  return acc;
}, {});

export { getToolDisplayMode } from './displayMode.js';

/**
 * Returns all tools that are marked as `isGlobal: true`.
 * These tools should be automatically injected into every AI agent context.
 */
export const getGlobalTools = () => {
  return Object.values(tools)
    .filter((t) => t.isGlobal)
    .map((t) => {
      return {
        id: `builtin:${t.name}`,
        name: t.name,
        description: t.description || 'System built-in global tool',
        type: 'CODE', // Forces SkillService.execute() to route this to _executeCodeSkill
        implementationRef: t.name,
        inputSchema: t.inputSchema || z.object({}),
        hideResult: !!t.hideResult,
        isGlobal: true,
      };
    });
};

/**
 * Returns all tools that are NOT global.
 * These are "system skills" that users explicitly pick in workflow nodes or the UI.
 */
export const getNonGlobalTools = () => {
  return (
    Object.values(tools)
      // .filter((t) => !t.isGlobal)
      .map((t) => {
        return {
          id: `builtin:${t.name}`,
          name: t.name,
          description: t.description || 'System built-in feature',
          type: 'CODE',
          implementationRef: t.name,
          inputSchema: t.inputSchema || z.object({}),
          hideResult: !!t.hideResult,
        };
      })
  );
};

/**
 * Native execution point for all built-in tools (global and non-global).
 */
export const executeBuiltinTool = async (toolName, args, context) => {
  const tool = tools[toolName];
  if (!tool || !tool.execute) {
    throw new Error(`Built-in tool implementation '${toolName}' not found`);
  }
  return await tool.execute(args, context);
};

/**
 * Fetches a built-in tool's configuration by its normalized string name (e.g. 'get_document')
 * This provides absolute decoupling between external callers and the internal file structure of builtins.
 */
export const getBuiltinToolConfig = (toolName) => {
  const tool = tools[toolName];
  if (!tool) throw new Error(`Built-in tool configuration '${toolName}' not found`);
  return tool;
};
