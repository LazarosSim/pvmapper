import { describe, expect, it } from 'vitest';
import { nextRowName, planSubRow } from './row-naming';

describe('nextRowName', () => {
  it('starts at Row 1', () => {
    expect(nextRowName([])).toBe('Row 1');
  });

  it('follows the highest row number, counting subrows by their base number', () => {
    expect(nextRowName(['Row 1', 'Row 2', 'Row 3_a', 'Row 3_b', 'Row 10'])).toBe('Row 11');
  });

  it('ignores custom names when numbering', () => {
    expect(nextRowName(['North string', 'Row 2'])).toBe('Row 3');
  });
});

describe('planSubRow', () => {
  it('renames a plain row to _a and adds _b', () => {
    expect(planSubRow('Row 5', ['Row 4', 'Row 5'])).toEqual({
      renameParentTo: 'Row 5_a',
      newRowName: 'Row 5_b',
    });
  });

  it('adds the next letter after the last subrow', () => {
    expect(planSubRow('Row 5_a', ['Row 5_a', 'Row 5_b', 'Row 5_c', 'Row 6_d'])).toEqual({
      newRowName: 'Row 5_d',
    });
  });

  it('rejects names it cannot number', () => {
    expect(planSubRow('North string', [])).toEqual({
      error: 'Unable to determine parent row base name',
    });
  });
});
