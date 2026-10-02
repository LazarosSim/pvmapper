/**
 * Every change to barcodes goes through here: it is applied to the phone's copy and
 * queued in the outbox in one transaction, then uploaded by the sync engine. The same
 * code runs online and offline.
 */
import { applyOp } from './apply-ops';
import {
  codeKey,
  db,
  isPlaceholderCode,
  type BarcodeData,
  type LocalBarcode,
  type OutboxEntry,
  type OutboxOp,
} from './db';
import { hasValidLength, nextOrderInRow, normalizeCode } from '@/lib/scan-rules';

let notifyChange: () => void = () => undefined;

/** Called after every local change (the sync engine uploads it shortly after). */
export function onLocalChange(listener: () => void) {
  notifyChange = listener;
}

const opBarcodeId = (op: OutboxOp): string | undefined =>
  op.type === 'add' || op.type === 'insertAt' ? op.barcode.id : op.type === 'resetRow' ? undefined : op.id;

/** Apply an operation to the local copy of a row (when the phone has it) and queue it. */
async function commit(rowId: string, op: OutboxOp): Promise<void> {
  const row = await db.rows.get(rowId);
  if (row) {
    const current = await db.barcodes.where('rowId').equals(rowId).toArray();
    const next = applyOp(current, op, row.parkId);
    const nextIds = new Set(next.map((b) => b.id));
    const before = new Map(current.map((b) => [b.id, b]));
    const removed = current.filter((b) => !nextIds.has(b.id)).map((b) => b.id);
    const changed = next.filter((b) => JSON.stringify(before.get(b.id)) !== JSON.stringify(b));
    if (removed.length) await db.barcodes.bulkDelete(removed);
    if (changed.length) await db.barcodes.bulkPut(changed);
  }
  const entry: OutboxEntry = {
    id: crypto.randomUUID(),
    rowId,
    op,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await db.outbox.add(entry);
}

const tx = <T>(fn: () => Promise<T>) =>
  db.transaction('rw', [db.parks, db.rows, db.barcodes, db.outbox], fn).then((result) => {
    notifyChange();
    return result;
  });

type ScanCheck =
  | { ok: true; alsoInRows: string[] }
  | { ok: false; reason: 'duplicate' | 'length' | 'unknown-row' };

/** Rules for a scanned code: length (when the park asks for it), duplicates in the row
 *  (rejected) and in other rows of the park (allowed, reported as a warning). */
async function checkCode(rowId: string, code: string, isPlaceholder: boolean): Promise<ScanCheck> {
  const row = await db.rows.get(rowId);
  if (!row) return { ok: false, reason: 'unknown-row' };
  if (isPlaceholder) return { ok: true, alsoInRows: [] };

  const park = await db.parks.get(row.parkId);
  if (park?.validateBarcodeLength && !hasValidLength(code)) return { ok: false, reason: 'length' };

  const sameCode = await db.barcodes.where('[parkId+codeKey]').equals([row.parkId, codeKey(code)]).toArray();
  if (sameCode.some((b) => b.rowId === rowId)) return { ok: false, reason: 'duplicate' };

  const otherRowIds = [...new Set(sameCode.map((b) => b.rowId))];
  const otherRows = await db.rows.bulkGet(otherRowIds);
  return { ok: true, alsoInRows: otherRows.map((r) => r?.name ?? '?') };
}

export type ScanResult =
  | { ok: true; barcode: BarcodeData; alsoInRows: string[] }
  | { ok: false; reason: 'duplicate' | 'length' | 'unknown-row' };

/** Save a scan at the end of the row. Placeholders get a unique code. The scan screen gives
 *  the id and time of the scan itself, so it can show the scan before it is saved. */
export async function addScan(input: {
  id?: string;
  timestamp?: string;
  rowId: string;
  code: string;
  userId: string;
  isPlaceholder?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<ScanResult> {
  return tx<ScanResult>(async () => {
    const timestamp = input.timestamp ?? new Date().toISOString();
    const code = input.isPlaceholder ? `X_PLACEHOLDER_${timestamp}` : normalizeCode(input.code);
    const check = await checkCode(input.rowId, code, !!input.isPlaceholder);
    if (check.ok === false) return { ok: false as const, reason: (check as { reason: 'duplicate' | 'length' | 'unknown-row' }).reason };

    const orders = (await db.barcodes.where('rowId').equals(input.rowId).toArray()).map((b) => b.orderInRow);
    const barcode: BarcodeData = {
      id: input.id ?? crypto.randomUUID(),
      rowId: input.rowId,
      code,
      orderInRow: nextOrderInRow(orders),
      timestamp,
      userId: input.userId,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    };
    await commit(input.rowId, { type: 'add', barcode });
    return { ok: true, barcode, alsoInRows: check.alsoInRows };
  });
}

/** Add a barcode at the end of a row (row detail page). Same rules as before: none. */
export function addBarcodeToRow(rowId: string, rawCode: string, userId: string): Promise<BarcodeData> {
  return tx(async () => {
    const orders = (await db.barcodes.where('rowId').equals(rowId).toArray()).map((b) => b.orderInRow);
    const barcode: BarcodeData = {
      id: crypto.randomUUID(),
      rowId,
      code: normalizeCode(rawCode),
      orderInRow: nextOrderInRow(orders),
      timestamp: new Date().toISOString(),
      userId,
    };
    await commit(rowId, { type: 'add', barcode });
    return barcode;
  });
}

/** Insert a barcode right after another one. */
export function insertBarcodeAfter(after: LocalBarcode | BarcodeData, rawCode: string, userId: string): Promise<BarcodeData> {
  return tx(async () => {
    const barcode: BarcodeData = {
      id: crypto.randomUUID(),
      rowId: after.rowId,
      code: normalizeCode(rawCode),
      orderInRow: after.orderInRow + 1,
      timestamp: new Date().toISOString(),
      userId,
    };
    await commit(after.rowId, { type: 'insertAt', barcode });
    return barcode;
  });
}

/** Unsent 'add' for this barcode, if it can still be changed instead of queueing more work. */
async function pendingAdd(barcodeId: string): Promise<OutboxEntry | undefined> {
  const entries = await db.outbox.where('status').equals('pending').toArray();
  return entries.find((e) => e.op.type === 'add' && e.op.barcode.id === barcodeId);
}

export function updateBarcode(rowId: string, barcodeId: string, rawCode: string): Promise<void> {
  return tx(async () => {
    const code = normalizeCode(rawCode);
    const add = await pendingAdd(barcodeId);
    if (add && add.op.type === 'add') {
      // Not uploaded yet: upload the corrected code instead
      const op: OutboxOp = { type: 'add', barcode: { ...add.op.barcode, code } };
      await db.outbox.update(add.seq!, { op });
      const local = await db.barcodes.get(barcodeId);
      if (local) await db.barcodes.put({ ...local, code, codeKey: codeKey(code) });
      return;
    }
    await commit(rowId, { type: 'update', id: barcodeId, code });
  });
}

export function deleteBarcode(rowId: string, barcodeId: string): Promise<void> {
  return tx(async () => {
    const add = await pendingAdd(barcodeId);
    if (add) {
      // Never uploaded: drop it and its pending edits instead of uploading and deleting
      const related = (await db.outbox.where('status').equals('pending').toArray()).filter(
        (e) => opBarcodeId(e.op) === barcodeId
      );
      await db.outbox.bulkDelete(related.map((e) => e.seq!));
      await db.barcodes.delete(barcodeId);
      return;
    }
    await commit(rowId, { type: 'delete', id: barcodeId });
  });
}

/** Delete every barcode of a row, including ones not uploaded yet. Returns how many. */
export function resetRow(rowId: string): Promise<number> {
  return tx(async () => {
    const count = await db.barcodes.where('rowId').equals(rowId).count();
    // Unsent changes to this row are moot; ones being uploaded right now stay and are reset after
    const moot = (await db.outbox.where('rowId').equals(rowId).toArray()).filter((e) => e.status !== 'sending');
    await db.outbox.bulkDelete(moot.map((e) => e.seq!));
    await commit(rowId, { type: 'resetRow' });
    return count;
  });
}

/** Unsent changes that the server refused: shown to the user, kept until dismissed. */
export function discardFailed(seq: number): Promise<void> {
  return tx(async () => {
    await db.outbox.delete(seq);
  });
}

export function retryFailed(): Promise<void> {
  return tx(async () => {
    await db.outbox.where('status').equals('failed').modify({ status: 'pending', error: undefined });
  });
}

export { isPlaceholderCode };

/** A row was deleted on the server: drop its copy and its unsent changes (the user confirmed
 *  deleting the row with all its barcodes; left queued they would be refused forever). */
export function forgetRow(rowId: string): Promise<void> {
  return tx(async () => {
    const queued = (await db.outbox.where('rowId').equals(rowId).toArray()).filter((e) => e.status !== 'sending');
    await db.outbox.bulkDelete(queued.map((e) => e.seq!));
    await db.barcodes.where('rowId').equals(rowId).delete();
    await db.rows.delete(rowId);
  });
}
