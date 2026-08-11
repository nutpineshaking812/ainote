/**
 * Helper to extract tags like <think> and <intent> from LLM output.
 */

export function extractTags(content = '') {
  const result = {
    content: content,
    thought: null,
    intent: null,
  };

  if (!content || typeof content !== 'string') return result;

  // 1. Extract <think>
  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    result.thought = thinkMatch[1].trim();
  }

  // 2. Extract <message>
  const messageMatch = content.match(/<message>([\s\S]*?)<\/message>/i);
  if (messageMatch) {
    result.messageContent = messageMatch[1].trim();
  }

  // 3. Extract <intent>
  const intentMatch = content.match(/<intent>([\s\S]*?)<\/intent>/i);
  if (intentMatch) {
    const rawIntent = intentMatch[1].trim();
    try {
      result.intent = JSON.parse(rawIntent);
    } catch (e) {
      console.warn('[AI Parser] Failed to parse intent JSON:', e.message);
      // Fallback: try to find any JSON inside if it's messy
      const jsonMatch = rawIntent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result.intent = JSON.parse(jsonMatch[0]);
        } catch (innerE) {}
      }
    }
  }

  // 4. Extract JSON from blocks or raw string
  let rawJson = null;
  // Try ```json block first - be flexible with whitespace
  const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch) {
    rawJson = jsonBlockMatch[1].trim();
  } else {
    // Try generic ``` block
    const genericBlockMatch = content.match(/```\s*([\s\S]*?)\s*```/i);
    if (genericBlockMatch && genericBlockMatch[1].includes('{')) {
      rawJson = genericBlockMatch[1].trim();
    } else {
      // Try finding something that looks like a JSON object anywhere in the text
      // Look for the last { ... } pair
      const lastJsonMatch = content.match(/\{[\s\S]*\}/);
      if (lastJsonMatch) {
        rawJson = lastJsonMatch[0].trim();
      }
    }
  }

  if (rawJson) {
    try {
      // Clean up potential markdown artifacts inside the match
      const cleanedJson = rawJson.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      result.json = JSON.parse(cleanedJson);
    } catch (e) {
      // Silent fail
    }
  }

  // 5. Final content determination:
  // Use messageContent if available, otherwise use cleaned content
  const cleanedContent = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<message>[\s\S]*?<\/message>/gi, '')
    .replace(/<intent>[\s\S]*?<\/intent>/gi, '')
    .trim();

  result.content = result.messageContent || cleanedContent;

  // 6. Merge parsed JSON into the root result if it exists
  // This allows nodes to access properties directly like nodes.agent.output.extractedItems
  if (result.json && typeof result.json === 'object' && !Array.isArray(result.json)) {
    Object.assign(result, result.json);
  }

  return result;
}
