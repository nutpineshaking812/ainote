/**
 * Read User Property Plugin Handler
 */
export async function handler(params, ctx) {
  try {
    const { key, defaultValue = '0', ttl = null } = params;

    if (!key) {
      throw new Error('Key is required for reading variable');
    }

    // Call contextual userProperties.get which wraps userPropertyService.getProperty
    // Pass the third argument 'ttl' to support sliding lease renewals
    const value = await ctx.userProperties.get(key, defaultValue, ttl);

    return {
      success: true,
      result: {
        value
      }
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}
