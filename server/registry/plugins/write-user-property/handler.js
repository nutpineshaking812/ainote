/**
 * Write User Property Plugin Handler
 */
export async function handler(params, ctx) {
  try {
    const { key, value, strategy = 'overwrite', ttl = null } = params;

    if (!key) {
      throw new Error('Key is required for writing variable');
    }

    // Call contextual userProperties.set which wraps userPropertyService.setProperty
    const newValue = await ctx.userProperties.set(key, value, strategy, ttl);

    return {
      success: true,
      result: {
        value: newValue
      }
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}
