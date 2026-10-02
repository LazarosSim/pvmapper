/**
 * Rules applied to every scanned barcode before it is saved.
 */

export const MIN_BARCODE_LENGTH = 19;
export const MAX_BARCODE_LENGTH = 26;

/** Scanners can add leading/trailing whitespace; it is never part of the code. */
export const normalizeCode = (raw: string): string => raw.trim();

export const hasValidLength = (code: string): boolean =>
  code.length >= MIN_BARCODE_LENGTH && code.length <= MAX_BARCODE_LENGTH;

/** Case- and whitespace-insensitive match against codes already in the row. */
export const isDuplicateCode = (code: string, existingCodes: Iterable<string>): boolean => {
  const needle = normalizeCode(code).toLowerCase();
  for (const existing of existingCodes) {
    if (normalizeCode(existing).toLowerCase() === needle) return true;
  }
  return false;
};

/**
 * Position for a barcode appended to a row: one after the highest position in use.
 * Deleting barcodes leaves gaps, so the count of barcodes can collide with an existing position.
 */
export const nextOrderInRow = (existingOrders: Iterable<number | null | undefined>): number => {
  let max = -1;
  for (const order of existingOrders) {
    if (typeof order === 'number' && order > max) max = order;
  }
  return max + 1;
};
