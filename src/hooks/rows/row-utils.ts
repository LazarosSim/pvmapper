
import type { Row, Barcode } from '../../lib/types/db-types.ts';

/**
 * Get rows for a specific park
 */
export const getRowsByParkId = (rows: Row[], parkId: string): Row[] => {
  return rows.filter(row => row.parkId === parkId);
};

/**
 * Get a specific row by ID
 */
export const getRowById = (rows: Row[], rowId: string): Row | undefined => {
  return rows.find(row => row.id === rowId);
};

/**
 * Count barcodes in a specific row
 */
export const countBarcodesInRow = (barcodes: Barcode[], rowId: string): number => {
  if (!barcodes || !rowId) return 0;
  return barcodes.filter(barcode => barcode.rowId === rowId).length;
};

/**
 * Get all barcodes for a specific row
 */
export const getBarcodesByRowId = (barcodes: Barcode[], rowId: string): Barcode[] => {
  if (!barcodes || !rowId) return [];
  return barcodes.filter(barcode => barcode.rowId === rowId);
};
