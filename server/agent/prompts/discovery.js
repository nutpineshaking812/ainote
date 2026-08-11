/**
 * Unified prompt templates for AI Agent orchestration.
 * Centralizing these ensures consistent behavior across different execution layers
 * (handleAITurn, and SkillAgent).
 */

/**
 * Generates the unified SOP discovery prompt for AI agents.
 */
export const getSkillDiscoveryPrompt = (promptSnippets) => {
  if (!promptSnippets || promptSnippets.length === 0) return '';

  return `
## Specialized Skill Mapping
1. **Mandatory Investigation (CRITICAL)** – NEVER attempt to guess or hallucinate the content, SOPs, templates, or logic of a skill. You MUST call tools to obtain the ground truth.
2. **Selection & Initialization** – If a match exists, you **must** call the built‑in tool **“read_skill”** to load the SOP before proceeding with any domain-specific task.
   - **Never** call a tool that shares the same name as the skill (e.g. “multi‑search‑engine”).  
   - The **only** valid tool name to start a skill is **“read_skill”**.

3. **Read and Follow (STRICT)** – Once “read_skill” is invoked, you MUST read the full content of the skill's instructions (SOP) and **strictly follow** every rule, constraint, and step-by-step procedure defined therein. The skill document (usually SKILL.md) is your primary directive for that specific domain.

4. **Arguments & Discovery (STRICT)** – For all skill-related tools, you must use the following argument names:
   - **read_skill**: Use 'location' for the skill ID and 'args' for initialization data.
   - **list_skill_resources**: Use 'location' ONLY. Never use 'skill_name'.
   - **read_skill_resource**: Use 'location' for the identifier and 'path' for the file path.

5. **Setup (CRITICAL)** – If the skill’s <input_schema> defines mandatory parameters, extract the required data from the conversation and place it inside the 'args' field of the read_skill call.

6. **Chained References (CRITICAL)** – When reading a SOP document, you may encounter inline annotations in the format:
   \`[SKILL_REF: {type}:{id} | {Title}]\` (where type can be doc, tool, mcp, form, or view).
   - **For type "doc"** (e.g., \`doc:{id}\`): You MUST call **read_skill(location="doc:{id}")** to load and read the SOP document content, then follow its instructions.
   - **For type "tool" or "mcp"** (e.g., \`tool:{name}\` or \`mcp:{name}\`): You MUST call the corresponding tool directly from your available tools list using the tool call mechanism. Do NOT call \`read_skill\` for tools or MCP references.
   - Do NOT treat these as regular web links or skip them.

<available_skills>
${promptSnippets.join('\n')}
</available_skills>`.trim();
};

/**
 * Generates the System Execution Protocol for built-in tools.
 */
export const getSystemProtocolPrompt = (globalTools = []) => {
  return `
## System Execution Protocol (Optimized for Designer)
1. **STRATEGIC DISCOVERY**: Follow the "Audit Policy" in the specialized skill document. Call “list_skill_resources” first; then, only audit changed or core nodes (like aiAgent) to prevent token waste and latency.
2. **DESIGN/EXECUTION BOUNDARY**: When in "Designer Mode", your goal is to generate configurations. DO NOT invoke business tools (e.g., web_fetch, curl) to retrieve actual data unless the user explicitly asks for a live data preview.
3. **VERSION PRIORITY**: Always treat ”history/evolution.md“ as the supreme truth if specifications in ".md" files appear outdated.
4. **ROLE-BASED OUTPUT**: The "Brief Confirmation" rule is waived for "Expert Designer" tasks. Follow the specific "Handover" section of the designer skill.
`;
};

/**
 * Generates the tool batching prompt — guides the model to call multiple
 * independent tools in a single response to reduce round-trips.
 */
export const getToolBatchingPrompt = () => {
  return `When you need multiple independent tools (tools that don't depend on each other's results), call them ALL in a single response. This avoids unnecessary round-trips.`;
};

/**
 * Generates the mandatory memory retrieval prompt.
 */
export const getMemoryRetrievalPrompt = () => {
  return `
## [IMPORTANT] 记忆检索优先原则
你已连接到项目的长期记忆系统。对于任何涉及历史事实、用户偏好或过往决策的问题，你【必须】首先调用 'recall_memory' 工具进行语义检索。`.trim();
};

/**
 * Helper to format a single skill discovery XML snippet.
 */
export const formatSkillDiscoverySnippet = (skill) => {
  const location = skill.id || skill.folderName || skill.name;
  const schemaStr = skill.inputSchema ? JSON.stringify(skill.inputSchema, null, 2) : '';

  return `  <skill>
    <name>${skill.name}</name>
    <description>${skill.description}</description>
    <location>${location}</location>${
      schemaStr
        ? `
    <input_schema>
${schemaStr}
    </input_schema>`
        : ''
    }
  </skill>`;
};
/**
 * Generates sub-skills and tool mapping guidelines for the sub-agent.
 */
export const getToolMappingPrompt = (docTools) => {
  if (!docTools || docTools.length === 0) return '';
  return '\n\n## Sub-Skills and Tool Mapping:\n' +
    'You have access to the following sub-skills/tools. Use them when instructed by the SOP:\n' +
    docTools.map(t => {
      const cleanId = String(t.id || t._id || '').replace(/^(pkg|doc):/, '');
      return `- **${t.name}**: Maps to document/link with ID "${cleanId}" or title "${t.label || t.name}"`;
    }).join('\n');
};

/**
 * Generates human request message structure for sub-agents.
 */
export const getSubAgentHumanPrompt = (rootQuestion, args) => {
  return [
    rootQuestion ? `### User's Original Request\n${rootQuestion}` : '',
    `### Your Specific Task & Material\nPlease process the following data according to your SOP:\n${JSON.stringify(args, null, 2)}`,
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');
};

/**
 * Generates a prompt block describing user-selected and current-context resources.
 * @param {Array<{label: string, type: string, id: string, isCurrent?: boolean}>} refs
 * @returns {string}
 */
export const getUserRefsPrompt = (refs) => {
  if (!Array.isArray(refs) || refs.length === 0) return '';

  const lines = refs.map((ref) => {
    const name = ref.label || 'Unnamed';
    return `- **${name}** [${ref.type || 'resource'}] (ID: ${ref.id || 'N/A'})`;
  });

  return `\n\n# User-Selected Resources\nThe user has explicitly selected the following resources for this task. Prioritize using them:\n${lines.join('\n')}`;
};

/**
 * Formats the returns string of read_skill containing the loaded context.
 */
export const getSkillContextPrompt = (resolvedLocation, args, meta, sopContent) => {
  const inputsStr = args ? JSON.stringify(args, null, 2) : 'No specific task arguments were provided for this load.';
  const toolsStr = meta.requires?.tools ? meta.requires.tools.map((t) => `- ${t}`).join('\n') : 'No specialized tools required for this SOP.';
  return `
<skill_context id="${resolvedLocation}">
  <task_inputs>
${inputsStr}
  </task_inputs>

  <required_tools>
${toolsStr}
  </required_tools>

  <sop_standard_procedure>
${sopContent}
  </sop_standard_procedure>

</skill_context>`.trim();
};
