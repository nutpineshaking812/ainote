import { createMiddleware } from 'langchain';
import { extractSkillName } from './utils.js';

export function createCustomToolAuthMiddleware(options = {}) {
  const { globalToolNames = [], allowedToolsRegistry = {}, logger } = options;
  const globalSet = new Set(globalToolNames);

  const log = (msg) => {
    if (logger?.sendConsoleLog) {
      logger.sendConsoleLog(msg);
    } else {
      console.log(msg);
    }
  };

  return createMiddleware({
    name: "CustomToolAuthMiddleware",
    wrapModelCall: async (request, handler) => {
      const messages = request.messages || [];
      const readSkills = new Set();

      // 1. Scan message history for read_file or view_file calls targeting SKILL.md
      for (const msg of messages) {
        if (msg.additional_kwargs?.tool_calls && Array.isArray(msg.additional_kwargs.tool_calls)) {
          for (const call of msg.additional_kwargs.tool_calls) {
            const callObj = call;
            if (callObj.function?.name === 'read_file' || callObj.function?.name === 'view_file') {
              try {
                const args = typeof callObj.function.arguments === 'string' 
                  ? JSON.parse(callObj.function.arguments) 
                  : callObj.function.arguments;
                const filePath = args?.file_path || args?.path || '';
                const skillName = extractSkillName(filePath);
                if (skillName) {
                  readSkills.add(skillName.toLowerCase());
                }
              } catch (e) {
                // Ignore JSON parsing errors
              }
            }
          }
        }
      }

      if (readSkills.size > 0) {
        log(`[ToolAuth] 扫描到已精读的技能文档: [${Array.from(readSkills).join(', ')}]`);
      }

      // 2. Retrieve skills metadata from the request's agent state
      const stateObj = request.state;
      const skillsMetadata = stateObj?.skillsMetadata || [];
      const unlockedTools = new Set();

      // 3. For each read skill, unlock its allowed-tools
      for (const skill of skillsMetadata) {
        const skillNameLower = String(skill.name || '').toLowerCase();
        if (readSkills.has(skillNameLower)) {
          const allowed = skill.allowedTools || allowedToolsRegistry[skill.name] || [];
          if (allowed.length > 0) {
            log(`[ToolAuth] 技能 "${skill.name}" 动态解锁工具权限: [${allowed.join(', ')}]`);
          }
          for (const tName of allowed) {
            unlockedTools.add(tName);
          }
        }
      }

      // 4. Filter the tools list passed to the model
      const filteredTools = (request.tools || []).filter((tool) => {
        const name = typeof tool === 'string' ? tool : tool.name;
        // Global tools are always allowed
        if (globalSet.has(name)) return true;
        // Check if unlocked dynamically
        return unlockedTools.has(name);
      });

      const totalTools = request.tools?.length || 0;
      const filteredCount = filteredTools.length;
      if (totalTools !== filteredCount) {
        log(`[ToolAuth] 动态鉴权完成。原始工具数: ${totalTools} | 过滤后可用工具数: ${filteredCount}`);
      }

      return handler({
        ...request,
        tools: filteredTools,
      });
    }
  });
}
