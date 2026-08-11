/**
 * Switch Branch Logic Plugin Handler
 * Enterprise-grade multi-branch router supporting rich operators,
 * case-insensitive matching, type-agnostic comparisons, and dynamic routing.
 */
export async function handler(params, ctx) {
  try {
    const { expression, cases = [] } = params;

    // The expression to evaluate
    const exprVal = expression;

    let nextHandleId = 'default';

    if (Array.isArray(cases)) {
      for (const c of cases) {
        if (c === null || c === undefined) continue;

        // Support both simple string values and detailed case objects
        const isObj = typeof c === 'object';
        const caseVal = isObj ? c.value : c;
        const caseHandle = isObj ? c.handle || c.value : c;
        const operator = isObj ? c.operator || 'equals' : 'equals';
        const caseSensitive = isObj ? !!c.caseSensitive : false;

        // Perform comparison based on the chosen operator
        let matched = false;

        // For string operations, prepare representations
        const exprStr = exprVal !== undefined && exprVal !== null ? String(exprVal).trim() : '';
        const caseStr = caseVal !== undefined && caseVal !== null ? String(caseVal).trim() : '';

        const leftStr = caseSensitive ? exprStr : exprStr.toLowerCase();
        const rightStr = caseSensitive ? caseStr : caseStr.toLowerCase();
        console.log('operator', operator, leftStr, rightStr);

        switch (operator) {
          case 'equals':
          case '=':
            matched = leftStr === rightStr;
            break;
          case 'strict_equals':
            matched = String(exprVal) === String(caseVal);
            break;
          case 'not_equals':
          case '!=':
            matched = leftStr !== rightStr;
            break;
          case 'contains':
            matched = leftStr.includes(rightStr);
            break;
          case 'not_contains':
            matched = !leftStr.includes(rightStr);
            break;
          case 'starts_with':
            matched = leftStr.startsWith(rightStr);
            break;
          case 'ends_with':
            matched = leftStr.endsWith(rightStr);
            break;
          case 'regex':
            try {
              const regex = new RegExp(caseStr, caseSensitive ? '' : 'i');
              matched = regex.test(exprStr);
            } catch (e) {
              matched = false;
            }
            break;
          case 'greater_than':
          case '>':
            matched = Number(exprVal) > Number(caseVal);
            break;
          case 'less_than':
          case '<':
            matched = Number(exprVal) < Number(caseVal);
            break;
          case 'greater_equal':
          case '>=':
            matched = Number(exprVal) >= Number(caseVal);
            break;
          case 'less_equal':
          case '<=':
            matched = Number(exprVal) <= Number(caseVal);
            break;
          case 'is_empty':
            matched = exprVal === undefined || exprVal === null || String(exprVal).trim() === '';
            break;
          case 'is_not_empty':
            matched = exprVal !== undefined && exprVal !== null && String(exprVal).trim() !== '';
            break;
          case 'custom':
            try {
              // Allows raw JS code evaluation for maximum power
              matched = !!new Function(`return (${caseVal})`)();
            } catch (e) {
              matched = false;
            }
            break;
          default:
            matched = leftStr === rightStr;
        }

        if (matched) {
          nextHandleId = String(caseHandle);
          break;
        }
      }
    }

    return {
      success: true,
      result: {
        expression: exprVal,
        matchedCase: nextHandleId,
      },
      nextHandleId,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}
