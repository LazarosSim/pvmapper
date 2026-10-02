/**
 * The single rule for what a row looks like after local changes: the server's barcodes
 * with the outbox operations applied in order. Used when a change is made on the phone
 * and when a row is downloaded again, so both always agree. Mirrors what the server
 * does when the same operations are uploaded.
 */
import { codeKey, type BarcodeData, type LocalBarcode, type OutboxOp } from './db';

const toLocal = (barcode: BarcodeData, parkId: string): LocalBarcode => ({
  ...barcode,
  parkId,
  codeKey: codeKey(barcode.code),
  pending: 1,
});

export function applyOp(barcodes: LocalBarcode[], op: OutboxOp, parkId: string): LocalBarcode[] {
  switch (op.type) {
    case 'add': {
      const others = barcodes.filter((b) => b.id !== op.barcode.id);
      return [...others, toLocal(op.barcode, parkId)];
    }
    case 'insertAt': {
      // Already there: the server skips it too
      if (barcodes.some((b) => b.id === op.barcode.id)) return barcodes;
      const position = op.barcode.orderInRow;
      const shifted = barcodes.map((b) =>
        b.orderInRow >= position ? { ...b, orderInRow: b.orderInRow + 1 } : b
      );
      return [...shifted, toLocal(op.barcode, parkId)];
    }
    case 'update':
      return barcodes.map((b) =>
        b.id === op.id ? { ...b, code: op.code, codeKey: codeKey(op.code), pending: 1 } : b
      );
    case 'delete':
      return barcodes.filter((b) => b.id !== op.id);
    case 'resetRow':
      return [];
  }
}

export function applyOps(barcodes: LocalBarcode[], ops: OutboxOp[], parkId: string): LocalBarcode[] {
  return ops.reduce((current, op) => applyOp(current, op, parkId), barcodes);
}

/** Barcodes in row order; equal positions (old data) fall back to scan time. */
export function sortBarcodes<T extends { orderInRow: number; timestamp: string }>(barcodes: T[]): T[] {
  return [...barcodes].sort(
    (a, b) => a.orderInRow - b.orderInRow || a.timestamp.localeCompare(b.timestamp)
  );
}
