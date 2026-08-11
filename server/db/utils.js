/**
 * Drizzle Response Mappers
 * Used to transform database results to match application expectations.
 */

/**
 * Maps PostgreSQL 'id' to MongoDB-style '_id' for frontend compatibility.
 * This helper ensures that we can transition to UUIDs in the backend while 
 * maintaining legacy support for existing frontend code.
 * 
 * @param {Object|Array} data - The repository result to map
 * @returns {Object|Array} - Mapped data with both 'id' and '_id'
 */
export function mapResponse(data) {
  if (!data) return null;
  
  // Handle Array results
  if (Array.isArray(data)) {
    return data.map(mapResponse);
  }
  
  // Handle single object results
  // We keep the original id and add _id as an alias
  return { ...data, _id: data.id };
}
