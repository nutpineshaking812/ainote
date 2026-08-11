// Utility for generating short collision-resistant IDs for form fields.
// Space: custom alphabet (no ambiguous chars) length^4 combinations.
// Provides generateShortId(existingIds) and optionally can expand length.

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // Removed I, L, O, 0, 1 to avoid confusion.
const DEFAULT_LENGTH = 4;

/**
 * Generate a short unique id not present in existingIds.
 * Retries until a free id found or space exhausted.
 * @param {Set<string>|string[]} existingIds - Collection of already used IDs.
 * @param {number} length - Length of the id, default 4.
 * @returns {string} short id.
 */
export function generateShortId(existingIds, length = DEFAULT_LENGTH, prefix = 'F_') {
  const used = existingIds instanceof Set ? existingIds : new Set(existingIds || []);
  const spaceSize = Math.pow(ALPHABET.length, length);
  if (used.size >= spaceSize) {
    throw new Error('Short ID space exhausted');
  }
  let id;
  do {
    const core = Array.from(
      { length },
      () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)],
    ).join('');
    id = `${prefix}${core}`;
  } while (used.has(id));
  return id;
}

/**
 * Optionally: deterministic expansion if collisions become frequent.
 * For now a simple wrapper.
 */
export function generateExtendedShortId(existingIds, prefix = 'F_') {
  // Use length 5 for larger space when needed.
  return generateShortId(existingIds, DEFAULT_LENGTH + 1, prefix);
}

export default generateShortId;
