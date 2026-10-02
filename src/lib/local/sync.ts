/**
 * Keeps the phone's copy and the server in step:
 *  1. upload the outbox in order (adds and deletes in batches); changes the server refuses
 *     are set aside as "failed" instead of blocking everything behind them;
 *  2. download parks, then the rows of active parks, then the barcodes of rows whose
 *     version changed; unsent local changes are re-applied on top.
 * Runs on its own (start, reconnect, shortly after a change, every minute) and only one
 * sync runs at a time, also across tabs.
 */
import { applyOps } from './apply-ops';
import { codeKey, db, type LocalBarcode, type OutboxEntry, type OutboxOp } from './db';
import { onLocalChange } from './repo';
import { ServerError, toServerError, type ServerApi } from './server';

const ADD_BATCH = 500;
const ROWS_PER_DOWNLOAD = 80;
const CHANGE_DELAY_MS = 1500;
const INTERVAL_MS = 60_000;

export interface SyncStatus {
  syncing: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
}

let server: ServerApi | null = null;
let status: SyncStatus = { syncing: false, lastSyncedAt: null, lastError: null };
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;
let changeTimer: ReturnType<typeof setTimeout> | null = null;
let pushedListener: (rowIds: string[]) => void = () => undefined;

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((listener) => listener());
}

export const getSyncStatus = () => status;
export function subscribeSyncStatus(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Called with the rows changed by an upload (used to refresh server-only views). */
export function onPushed(listener: (rowIds: string[]) => void) {
  pushedListener = listener;
}

export function configureSync(api: ServerApi) {
  server = api;
}

const barcodeIdOf = (op: OutboxOp) =>
  op.type === 'add' || op.type === 'insertAt' ? op.barcode.id : op.type === 'resetRow' ? undefined : op.id;

async function send(api: ServerApi, entries: OutboxEntry[]) {
  const first = entries[0].op;
  if (first.type === 'add') {
    await api.insertBarcodes(entries.map((e) => (e.op as Extract<OutboxOp, { type: 'add' }>).barcode));
  } else if (first.type === 'delete') {
    await api.deleteBarcodes(entries.map((e) => (e.op as Extract<OutboxOp, { type: 'delete' }>).id));
  } else if (first.type === 'insertAt') {
    await api.insertBarcodeAt(first.barcode);
  } else if (first.type === 'update') {
    await api.updateBarcode(first.id, first.code);
  } else {
    await api.resetRow(entries[0].rowId);
  }
}

/** Next group to upload: consecutive adds (or deletes) together, anything else alone. */
function nextGroup(pending: OutboxEntry[]): OutboxEntry[] {
  const type = pending[0].op.type;
  if (type !== 'add' && type !== 'delete') return [pending[0]];
  const group: OutboxEntry[] = [];
  for (const entry of pending) {
    if (entry.op.type !== type || group.length >= ADD_BATCH) break;
    group.push(entry);
  }
  return group;
}

async function markUploaded(entries: OutboxEntry[]) {
  await db.transaction('rw', db.outbox, db.barcodes, async () => {
    await db.outbox.bulkDelete(entries.map((e) => e.seq!));
    const remaining = await db.outbox.toArray();
    const stillPending = new Set(remaining.map((e) => barcodeIdOf(e.op)));
    for (const entry of entries) {
      const id = barcodeIdOf(entry.op);
      if (id && !stillPending.has(id)) await db.barcodes.update(id, { pending: 0 });
    }
  });
}

async function push(api: ServerApi): Promise<string[]> {
  const touchedRows = new Set<string>();
  for (;;) {
    const pending = await db.outbox.where('status').equals('pending').sortBy('seq');
    if (pending.length === 0) return [...touchedRows];

    const group = nextGroup(pending);
    await db.outbox.bulkUpdate(group.map((e) => ({ key: e.seq!, changes: { status: 'sending' } })));
    try {
      await send(api, group);
      await markUploaded(group);
      group.forEach((e) => touchedRows.add(e.rowId));
    } catch (error) {
      const failure = toServerError(error);
      if (!failure.permanent) {
        await db.outbox.bulkUpdate(group.map((e) => ({ key: e.seq!, changes: { status: 'pending' } })));
        throw failure;
      }
      // Find the refused change(s) one at a time; the rest still go through
      for (const entry of group) {
        try {
          await send(api, [entry]);
          await markUploaded([entry]);
          touchedRows.add(entry.rowId);
        } catch (single) {
          const singleFailure = toServerError(single);
          if (!singleFailure.permanent) {
            await db.outbox.where('status').equals('sending').modify({ status: 'pending' });
            throw singleFailure;
          }
          await db.outbox.update(entry.seq!, { status: 'failed', error: singleFailure.message });
        }
      }
    }
  }
}

async function pull(api: ServerApi) {
  const parks = await api.fetchParks();
  const activeParkIds = parks.filter((p) => !p.archived).map((p) => p.id);
  const serverRows = await api.fetchRows(activeParkIds);

  // Parks, and rows that were deleted or whose park was archived
  await db.transaction('rw', db.parks, db.rows, db.barcodes, async () => {
    await db.parks.clear();
    await db.parks.bulkPut(parks);
    const keep = new Set(serverRows.map((r) => r.id));
    const gone = (await db.rows.toArray()).filter((r) => !keep.has(r.id)).map((r) => r.id);
    if (gone.length) {
      await db.rows.bulkDelete(gone);
      await db.barcodes.where('rowId').anyOf(gone).delete();
    }
  });

  const localVersions = new Map((await db.rows.toArray()).map((r) => [r.id, r.version]));
  const changed = serverRows.filter((r) => localVersions.get(r.id) !== r.version);

  for (let i = 0; i < changed.length; i += ROWS_PER_DOWNLOAD) {
    const rows = changed.slice(i, i + ROWS_PER_DOWNLOAD);
    const barcodes = await api.fetchBarcodes(rows.map((r) => r.id));
    const byRow = new Map<string, typeof barcodes>();
    for (const barcode of barcodes) {
      const list = byRow.get(barcode.rowId) ?? [];
      list.push(barcode);
      byRow.set(barcode.rowId, list);
    }

    // Unsent changes are read inside the same transaction, so scans made while this
    // download was running are not lost
    await db.transaction('rw', db.rows, db.barcodes, db.outbox, async () => {
      for (const row of rows) {
        const ops = (await db.outbox.where('rowId').equals(row.id).sortBy('seq'))
          .filter((e) => e.status !== 'failed')
          .map((e) => e.op);
        const fromServer: LocalBarcode[] = (byRow.get(row.id) ?? []).map((b) => ({
          ...b,
          parkId: row.parkId,
          codeKey: codeKey(b.code),
          pending: 0,
        }));
        await db.barcodes.where('rowId').equals(row.id).delete();
        await db.barcodes.bulkPut(applyOps(fromServer, ops, row.parkId));
        await db.rows.put(row);
      }
    });
  }
}

async function runSync() {
  if (!server) return;
  setStatus({ syncing: true });
  try {
    const touchedRows = await push(server);
    if (touchedRows.length) pushedListener(touchedRows);
    await pull(server);
    setStatus({ syncing: false, lastSyncedAt: new Date().toISOString(), lastError: null });
  } catch (error) {
    const message = error instanceof ServerError || error instanceof Error ? error.message : String(error);
    setStatus({ syncing: false, lastError: message });
    throw error;
  }
}

/** Upload and download now. Resolves when done; rejects if the server could not be reached. */
export function syncNow(): Promise<void> {
  if (inFlight) return inFlight;
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const run = locks
    ? locks.request('pvmapper-sync', { ifAvailable: true }, (lock) => (lock ? runSync() : undefined))
    : runSync();
  inFlight = Promise.resolve(run).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine;

function syncQuietly() {
  if (!isOnline()) return;
  syncNow().catch((error) => console.warn('[Sync] Will retry:', error));
}

/** Uploads interrupted by closing the app are sent again. */
export async function recoverInterruptedUploads() {
  await db.outbox.where('status').equals('sending').modify({ status: 'pending' });
}

/** Start automatic syncing for the signed-in user. Returns a function that stops it. */
export function startAutoSync(): () => void {
  onLocalChange(() => {
    if (changeTimer) clearTimeout(changeTimer);
    changeTimer = setTimeout(syncQuietly, CHANGE_DELAY_MS);
  });
  const onVisible = () => {
    if (document.visibilityState === 'visible') syncQuietly();
  };
  window.addEventListener('online', syncQuietly);
  document.addEventListener('visibilitychange', onVisible);
  const interval = setInterval(syncQuietly, INTERVAL_MS);

  recoverInterruptedUploads().finally(syncQuietly);

  return () => {
    onLocalChange(() => undefined);
    if (changeTimer) clearTimeout(changeTimer);
    window.removeEventListener('online', syncQuietly);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(interval);
  };
}
