import DocumentRepository from '../repositories/document.repository.js';
import { blocksToMarkdown } from './contentProcessor.js';

/**
 * Simple implementation of lodash.get
 */
const get = (obj, path, defaultValue) => {
  if (!obj) return defaultValue;
  const result = path
    .split('.')
    .reduce((o, key) => (o && o[key] !== undefined ? o[key] : undefined), obj);
  return result !== undefined ? result : defaultValue;
};

const INSTRUCTION_REGEX = /\$\[([a-zA-Z0-9_]+)(?:\|([^\]]+))?\]/g;

async function runInstruction(command, argument, appId, context) {
  const now = new Date();
  if (command === 'date') {
    const arg = argument ? argument.trim() : 'today';
    const dateObj = {
      today: now.toISOString().split('T')[0],
      now: now.toISOString(),
      year: now.getFullYear().toString(),
      month: (now.getMonth() + 1).toString().padStart(2, '0'),
      day: now.getDate().toString().padStart(2, '0'),
      timestamp: now.getTime().toString(),
    };
    if (dateObj[arg] !== undefined) {
      return dateObj[arg];
    }
    // Format date format string
    return arg
      .replace(/YYYY/g, now.getFullYear())
      .replace(/MM/g, String(now.getMonth() + 1).padStart(2, '0'))
      .replace(/DD/g, String(now.getDate()).padStart(2, '0'))
      .replace(/HH/g, String(now.getHours()).padStart(2, '0'))
      .replace(/mm/g, String(now.getMinutes()).padStart(2, '0'))
      .replace(/ss/g, String(now.getSeconds()).padStart(2, '0'));
  }

  if (command === 'readDoc' && argument) {
    let docId = argument.trim();
    const isPath = docId.includes('.') || docId === 'trigger' || docId === 'previousNode';
    if (isPath) {
      if (context) {
        const resolved = get(context, docId);
        if (resolved !== undefined && resolved !== null) {
          docId = String(resolved);
        } else {
          return `[Error: Variable "${docId}" is empty or not found]`;
        }
      } else {
        return `[Error: Variable "${docId}" not resolved]`;
      }
    }
    try {
      const doc = await DocumentRepository.findById(docId);
      if (!doc) return `[Error: Document with ID "${docId}" not found]`;
      const content = await blocksToMarkdown(doc.blocks || [], { serverRuntime: true });
      return content || '';
    } catch (e) {
      return `[Error: Document "${docId}" not found]`;
    }
  }

  if (command === 'readBlockPrompt' && argument) {
    let docId = argument.trim();
    const isPath = docId.includes('.') || docId === 'trigger' || docId === 'previousNode';
    if (isPath) {
      if (context) {
        const resolved = get(context, docId);
        if (resolved !== undefined && resolved !== null) {
          docId = String(resolved);
        } else {
          return `[Error: Variable "${docId}" is empty or not found]`;
        }
      } else {
        return `[Error: Variable "${docId}" not resolved]`;
      }
    }
    try {
      const doc = await DocumentRepository.findById(docId);
      if (!doc || !doc.blocks) return `[Error: Document with ID "${docId}" not found or empty]`;

      const { compileDocumentBlockPrompt } = await import('./documentPromptHelper.js');
      return await compileDocumentBlockPrompt(doc.blocks);
    } catch (e) {
      return `[Error: Document "${docId}" not found]`;
    }
  }

  return null;
}

function findInstructionPlaceholders(obj, instructions = []) {
  if (typeof obj === 'string') {
    let match;
    // Reset regex state
    INSTRUCTION_REGEX.lastIndex = 0;
    while ((match = INSTRUCTION_REGEX.exec(obj)) !== null) {
      instructions.push({
        raw: match[0],
        command: match[1].trim(),
        argument: match[2] ? match[2].trim() : undefined,
      });
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      findInstructionPlaceholders(item, instructions);
    }
  } else if (obj !== null && typeof obj === 'object') {
    for (const key in obj) {
      findInstructionPlaceholders(obj[key], instructions);
    }
  }
  return instructions;
}

function replaceInstructionPlaceholders(obj, results) {
  if (typeof obj === 'string') {
    return obj.replace(INSTRUCTION_REGEX, (match, command, argument) => {
      const argKey = argument ? argument.trim() : '';
      const key = `${command.trim()}|${argKey}`;
      return results[key] !== undefined ? results[key] : match;
    });
  } else if (Array.isArray(obj)) {
    return obj.map((item) => replaceInstructionPlaceholders(item, results));
  } else if (obj !== null && typeof obj === 'object') {
    const res = {};
    for (const key in obj) {
      res[key] = replaceInstructionPlaceholders(obj[key], results);
    }
    return res;
  }
  return obj;
}

/**
 * Resolves variable patterns {{path.to.value}} in a configuration object or string
 * @param {any} config - The configuration object or string to resolve
 * @param {object} context - The context containing values for variables
 * @returns {any} - The resolved configuration
 */
export const resolveVariables = async (config, context) => {
  const appId = context.appId;

  // Pass 1: Resolve variables first
  const semiResolvedConfig = resolveRecursive(config, context);

  // Pass 2: Resolve instructions (like readDoc now that it has the resolved docId)
  let resolvedConfig = semiResolvedConfig;
  const instructions = findInstructionPlaceholders(semiResolvedConfig);
  if (instructions.length > 0) {
    const results = {};
    await Promise.all(
      instructions.map(async ({ command, argument }) => {
        const argKey = argument ? argument.trim() : '';
        const key = `${command}|${argKey}`;
        const res = await runInstruction(command, argument, appId, context);
        if (res !== null) {
          results[key] = res;
        }
      })
    );
    resolvedConfig = replaceInstructionPlaceholders(semiResolvedConfig, results);
  }

  // Pass 3: Re-resolve standard variables in case instructions brought in new variables
  return resolveRecursive(resolvedConfig, context);
};

const resolveRecursive = (config, context) => {
  if (typeof config === 'string') {
    return resolveString(config, context);
  }

  if (Array.isArray(config)) {
    return config.map((v) => resolveRecursive(v, context));
  }

  if (config !== null && typeof config === 'object') {
    const resolved = {};
    for (const [key, value] of Object.entries(config)) {
      resolved[key] = resolveRecursive(value, context);
    }
    return resolved;
  }

  return config;
};

const resolveString = (str, context) => {
  // Pattern to match {{variable.path}}
  const pattern = /\{\{([^}]+)\}\}/g;

  // If the string is EXACTLY a variable pattern, we return the value directly
  // (allowing for non-string types like objects/arrays to be resolved)
  const exactMatch = str.match(/^\{\{([^}]+)\}\}$/);
  if (exactMatch) {
    const path = exactMatch[1].trim();
    const value = get(context, path);
    return value !== undefined ? value : str;
  }

  // Otherwise, we perform string replacement for all patterns
  return str.replace(pattern, (match, path) => {
    const value = get(context, path.trim());
    if (value === undefined) return match;
    return typeof value === 'object' ? JSON.stringify(value) : value;
  });
};

export default { resolveVariables };
