/**
 * Lexorank utility for calculating lexicographical order strings.
 * This implementation uses lowercase a-z and digits 0-9.
 */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const MIN_CHAR = ALPHABET[0];
const MID_CHAR = ALPHABET[Math.floor(ALPHABET.length / 2)];

/**
 * Generates a string that is lexicographically between prev and next.
 * @param {string} prev - The string before the target position
 * @param {string} next - The string after the target position
 * @returns {string} The new rank string
 */
export const generateRank = (prev: any = '', next: any = ''): string => {
  const p = String(prev || '');
  const n = String(next || '');
  let result = '';
  let i = 0;

  while (true) {
    const prevChar = p[i] || MIN_CHAR;
    const nextChar = n[i] || '{'; // '{' is lexicographically after 'z'

    if (prevChar === nextChar) {
      result += prevChar;
      i++;
      continue;
    }

    const prevIdx = ALPHABET.indexOf(prevChar);
    const nextIdx = nextChar === '{' ? ALPHABET.length : ALPHABET.indexOf(nextChar);

    if (nextIdx - prevIdx > 1) {
      // There's space between these characters
      const midIdx = Math.floor((prevIdx + nextIdx) / 2);
      result += ALPHABET[midIdx];
      break;
    } else {
      // No space between characters, move to next position
      result += prevChar;
      i++;
      
      // If we've run out of characters in prev, just append the middle character
      if (i >= prev.length) {
        result += MID_CHAR;
        break;
      }
    }
  }

  return result;
};

/**
 * Initial rank for the first item
 */
export const INITIAL_RANK = MID_CHAR;

export default {
  generateRank,
  INITIAL_RANK,
};
