
// Extract JSON (object or array) from text content, based on specific markers and rules.
function extractJson(content, marker) {
  if (!content || typeof content !== 'string') return null;

  // 规则：以字面字符串 "mark" 为锚点，取其后出现的第一个 JSON（数组优先）。
  let idx = 0; 
  if (!marker) {idx = 0;
  } else {
    idx = content.indexOf(marker);
  }
  let searchText = idx !== -1 ? content.slice(idx + marker.length) : content; // 若缺失标记则退化为全文

  // 如果后面紧跟 ```json 代码块，优先限制在此代码块内部，避免抓到后续无关数组
  const codeBlockMatch = searchText.match(/```json([\s\S]*?)```/i);
  if (codeBlockMatch) {
    // console.log('提取JSON时发现json代码块，优先使用代码块内容');
    searchText = codeBlockMatch[1];
  }
  const rawJson = findFirstJson(searchText);
  // console.log('提取到的原始JSON字符串:', rawJson);
  if (!rawJson) return null;
  return rawJson;
}

// Helper to find the first complete JSON object or array in text
const findFirstJson = (text) => {
  for (let i = 0; i < text.length; i++) {
    const start = text[i];
    if (start !== '{' && start !== '[') continue;
    const stack = [start];
    let j = i + 1;
    while (j < text.length && stack.length) {
      const ch = text[j];
      if (ch === '"') { // 跳过字符串
        j++;
        while (j < text.length) {
          if (text[j] === '"' && text[j - 1] !== '\\') { j++; break; }
          j++;
        }
        continue;
      }
      if (ch === '{' || ch === '[') stack.push(ch);
      else if (ch === '}' || ch === ']') {
        const open = stack[stack.length - 1];
        if ((open === '{' && ch === '}') || (open === '[' && ch === ']')) stack.pop();
        else return null; // 语法不平衡
      }
      j++;
    }
    if (stack.length === 0) {
      return text.slice(i, j);
    }
  }
  return null;
};

const MAX_TOOL_MESSAGE_LENGTH = 8000;

const safeJsonStringify = (value) => {
  try {
    const json = JSON.stringify(value);
    if (json.length > MAX_TOOL_MESSAGE_LENGTH) {
      return `${json.slice(0, MAX_TOOL_MESSAGE_LENGTH)}...(truncated)`;
    }
    return json;
  } catch (error) {
    return JSON.stringify({ error: "UNSERIALIZABLE_RESULT" });
  }
};

export {
  extractJson,
  findFirstJson,
  safeJsonStringify
};