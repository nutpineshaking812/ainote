import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAgentDock } from '../../../../../features/chat/context/AgentDockContext';
import { fetchEventSource } from '../../../../../utils/sse';

/**
 * Builds the structured prompt for a given task type and params.
 */
export const buildStructuredPrompt = (taskType, params) => {
  const RULES = `
【必须遵循的严格规则】：
1. 直接返回可执行的 JavaScript 代码块，【绝对不要】用 \`\`\`javascript 或 \`\`\` 标记包围代码。
2. 假定输入的数据保存在全局变量 \`input\` 中。【绝对不要】在代码的开头或任何地方重新声明、定义或初始化名为 \`input\` 的变量（严禁编写如 \`var input = ...;\` 或 \`const input = ...;\`）。全局变量 \`input\` 已由执行环境预先内置传入，请直接访问其属性。
3. 代码最终必须包含一个 \`return\` 语句来输出结果（如：\`return result;\`）。请直接返回您处理/转换后的原始数据（如数组、对象或基本值均可），底层引擎会自动进行规范的数据包装。
4. 加入 try-catch 异常安全捕获和合理的空值/边界值兜底逻辑，避免字段缺失时报错崩溃。
5. 坚决不要输出任何 HTML、Markdown 标记或任何非 JavaScript 代码的自然语言解释。`;

  if (taskType === 'extract') {
    const { sourceField, fields, inputSample } = params;
    let text = `请帮我编写一段 ES6 JavaScript 数据提取代码。`;
    if (sourceField) {
      text += `\n【数据来源路径】：input.${sourceField}（可能是数组）`;
    } else {
      text += `\n【数据来源】：input 根对象（可能是数组或对象）`;
    }
    if (fields) {
      text += `\n【需要提取的字段】：${fields}（如有重命名格式为：旧名->新名）`;
    }
    if (inputSample?.trim()) {
      text += `\n【输入数据样例】：\n${inputSample.trim()}`;
    }
    text += RULES;
    return text;
  }

  if (taskType === 'format') {
    const { fieldName, fromFormat, toFormat, inputSample } = params;
    let text = `请帮我编写一段 ES6 JavaScript 数据格式化代码。`;
    text += `\n【需要格式化的字段】：${fieldName || '(未填写)'}`;
    if (fromFormat) {
      text += `\n【当前格式/类型】：${fromFormat}`;
    }
    text += `\n【目标格式/类型】：${toFormat || '(未填写)'}`;
    if (inputSample?.trim()) {
      text += `\n【输入数据样例】：\n${inputSample.trim()}`;
    }
    text += RULES;
    return text;
  }

  return '';
};

/**
 * Inline AI code generator hook.
 * Streams generated code directly into the editor via onChunk callback.
 */
export const useAICopilot = ({
  roleFilter = (emp) => {
    const role = emp.roleTitle || '';
    const lower = role.toLowerCase();
    return lower === 'developer' || lower === '技术专家';
  },
  onChunk,       // (chunk: string) => void  — called for each streamed delta
  onDone,        // (fullCode: string) => void — called when stream completes
} = {}) => {
  const { allEmployees, activeEmployee, setActiveEmployee, summonEmployee } = useAgentDock();

  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef(null);
  const accCodeRef = useRef('');

  // Filtered developers - fallback to all employees if no specialized developers found
  const developers = useMemo(() => {
    const devs = allEmployees.filter(roleFilter);
    if (devs.length > 0) return devs;
    return allEmployees;
  }, [allEmployees, roleFilter]);

  // Selected employee ID — prefer currently active if it's a developer
  const selectedEmployeeId = useMemo(() => {
    if (!activeEmployee) return developers[0]?._id || developers[0]?.id || null;
    const activeId = activeEmployee._id || activeEmployee.id;
    const isDev = developers.some((d) => (d._id || d.id) === activeId);
    return isDev ? activeId : (developers[0]?._id || developers[0]?.id || null);
  }, [activeEmployee, developers]);

  const setSelectedEmployeeId = useCallback((id) => {
    const emp = allEmployees.find((e) => (e._id || e.id) === id);
    if (emp) {
      if (summonEmployee) summonEmployee(emp);
      setActiveEmployee(emp);
    }
  }, [allEmployees, setActiveEmployee, summonEmployee]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortRef.current?.(); };
  }, []);

  /**
   * Start streaming generation.
   * prompt: the full structured prompt string
   */
  const generate = useCallback((prompt) => {
    if (!selectedEmployeeId || !prompt.trim()) return;

    // Abort any existing stream
    abortRef.current?.();
    accCodeRef.current = '';
    setIsGenerating(true);

    const cancel = fetchEventSource(
      `/ai/employ/${selectedEmployeeId}/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: `inline-codegen-${Date.now()}`,
          message: prompt,
        }),
      },
      {
        onmessage: (msg) => {
          try {
            const parsed = JSON.parse(msg.data);
            const eventType = msg.event || parsed.type;

            if (eventType === 'text-delta' || eventType === 'text') {
              let delta = parsed.content || parsed.text || '';

              // Build accumulated code, strip markdown fences on the fly
              accCodeRef.current += delta;
              let cleaned = accCodeRef.current;
              if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '');
              }
              if (cleaned.endsWith('```')) {
                cleaned = cleaned.slice(0, -3);
              }
              cleaned = cleaned.trimStart();

              onChunk?.(cleaned);
            } else if (eventType === 'done' || eventType === 'stop') {
              setIsGenerating(false);
              onDone?.(accCodeRef.current);
            }
          } catch {
            // ignore parse errors
          }
        },
        onerror: () => {
          setIsGenerating(false);
        },
        onclose: () => {
          setIsGenerating(false);
        },
      }
    );

    abortRef.current = cancel;
  }, [selectedEmployeeId, onChunk, onDone]);

  const abort = useCallback(() => {
    abortRef.current?.();
    setIsGenerating(false);
  }, []);

  return {
    employees: developers,
    selectedEmployeeId,
    setSelectedEmployeeId,
    isGenerating,
    generate,
    abort,
  };
};
