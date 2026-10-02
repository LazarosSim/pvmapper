import { describe, expect, it } from 'vitest';
import { hasValidLength, isDuplicateCode, nextOrderInRow, normalizeCode } from './scan-rules';

describe('normalizeCode', () => {
  it('drops whitespace a scanner adds around the code', () => {
    expect(normalizeCode('  ABC123\t\n')).toBe('ABC123');
  });
});

describe('hasValidLength', () => {
  it('accepts 19 to 26 characters', () => {
    expect(hasValidLength('1'.repeat(18))).toBe(false);
    expect(hasValidLength('1'.repeat(19))).toBe(true);
    expect(hasValidLength('1'.repeat(26))).toBe(true);
    expect(hasValidLength('1'.repeat(27))).toBe(false);
  });
});

describe('isDuplicateCode', () => {
  it('ignores case and surrounding whitespace', () => {
    expect(isDuplicateCode('abc123 ', ['ABC123'])).toBe(true);
    expect(isDuplicateCode('ABC124', ['ABC123'])).toBe(false);
  });
});

describe('nextOrderInRow', () => {
  it('starts an empty row at 0', () => {
    expect(nextOrderInRow([])).toBe(0);
  });

  it('appends after the highest position, even when deletions left gaps', () => {
    // Positions 0, 1, 3 after deleting 2: the count (3) would collide with position 3
    expect(nextOrderInRow([0, 1, 3])).toBe(4);
  });

  it('skips missing positions', () => {
    expect(nextOrderInRow([null, undefined, 2])).toBe(3);
  });
});
