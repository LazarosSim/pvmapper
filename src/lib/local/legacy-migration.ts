/**
 * One-time move of what the OLD app version left on the phone into the new local store:
 *  - unsent scans, edits and deletes from the old IndexedDB queue ('pvmapper-offline')
 *    become outbox entries, in the order the old app would have uploaded them;
 *  - parks, rows and barcodes from the old React Query cache in localStorage seed the
 *    new store, so a phone updated in the field (offline) still shows its work.
 * Seeded rows get version -1 so the first online sync downloads them again. Everything
 * is written in one transaction; the old data is only removed after it commits, so a
 * failure leaves it in place for the next attempt.
 */
import { applyOps } from './apply-ops';
import {
  codeKey,
  db,
  type LocalBarcode,
  type LocalPark,
  type LocalRow,
  type OutboxEntry,
  type OutboxOp,
} from './db';
import type { QueuedMutation } from '../offline/types';

const OLD_DB_NAME = 'pvmapper-offline';
const OLD_STORE = 'mutations';
const CACHE_KEY = 'REACT_QUERY_OFFLINE_CACHE';
const MIGRATED_KEY = 'legacyMigrated';

export interface LegacyMigrationOptions {
  storage?: Storage;
  indexedDB?: IDBFactory;
}

export interface LegacyMigrationResult {
  /** Outbox entries added from the old queue */
  queued: number;
  /** Rows seeded from the old cache */
  seededRows: number;
}

// ---------------------------------------------------------------------------
// Reading the old data (before any Dexie transaction)
// ---------------------------------------------------------------------------

/** Opens the old database only if it exists; never creates it. */
function openOldDatabase(factory: IDBFactory): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(OLD_DB_NAME);
    } catch {
      resolve(null);
      return;
    }
    // Only fires when the database did not exist: abort so it is not created
    request.onupgradeneeded = () => request.transaction?.abort();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function readAllMutations(oldDb: IDBDatabase): Promise<QueuedMutation[]> {
  if (!oldDb.objectStoreNames.contains(OLD_STORE)) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const request = oldDb.transaction([OLD_STORE], 'readonly').objectStore(OLD_STORE).getAll();
    request.onsuccess = () => resolve((request.result ?? []) as QueuedMutation[]);
    request.onerror = () => reject(request.error);
  });
}

/** Same order as the old app's getQueue: scan time, then per-row sequence. */
function sortLikeOldQueue(mutations: QueuedMutation[]): QueuedMutation[] {
  return [...mutations].sort((a, b) => {
    const timeCompare = (a.payload?.timestamp ?? '').localeCompare(b.payload?.timestamp ?? '');
    if (timeCompare !== 0) return timeCompare;
    return (a.payload?.localSequence ?? 0) - (b.payload?.localSequence ?? 0);
  });
}

/** Old mutation -> new outbox entry (without seq); null when it cannot be converted. */
function toOutboxEntry(m: QueuedMutation): OutboxEntry | null {
  const p = m?.payload;
  if (!p?.rowId) return null;
  let op: OutboxOp;
  switch (m.type) {
    case 'ADD_BARCODE':
      // The old app used the mutation id as the barcode id on the server: keep it
      op = {
        type: 'add',
        barcode: {
          id: m.id,
          rowId: p.rowId,
          code: p.code,
          orderInRow: p.orderInRow,
          timestamp: p.timestamp,
          userId: p.userId ?? '',
          latitude: p.latitude,
          longitude: p.longitude,
        },
      };
      break;
    case 'DELETE_BARCODE':
      if (!p.barcodeId) return null;
      op = { type: 'delete', id: p.barcodeId };
      break;
    case 'UPDATE_BARCODE':
      if (!p.barcodeId || p.newCode == null) return null;
      op = { type: 'update', id: p.barcodeId, code: p.newCode };
      break;
    default:
      return null;
  }
  return {
    id: crypto.randomUUID(),
    rowId: p.rowId,
    op,
    status: 'pending', // 'syncing' and 'failed' are retried by the new sync
    createdAt: m.createdAt ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Old React Query cache
// ---------------------------------------------------------------------------

type Raw = Record<string, any>;

interface CachedData {
  parks: LocalPark[];
  rows: LocalRow[];
  /** Cached barcodes per row id */
  barcodes: Map<string, Raw[]>;
}

const isObject = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasId = (value: unknown): value is Raw => isObject(value) && typeof value.id === 'string';

/** Dates were persisted as ISO strings; tolerate anything else. */
const toIso = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : value instanceof Date ? value.toISOString() : fallback;

function readCache(storage: Storage | undefined): CachedData | null {
  if (!storage) return null;
  let parsed: unknown;
  try {
    const text = storage.getItem(CACHE_KEY);
    if (!text) return null;
    parsed = JSON.parse(text);
  } catch {
    return null; // corrupt cache: nothing to seed
  }
  const queries = isObject(parsed) && isObject(parsed.clientState) ? parsed.clientState.queries : null;
  if (!Array.isArray(queries)) return null;

  const now = new Date().toISOString();
  const parks = new Map<string, LocalPark>();
  const rows = new Map<string, LocalRow>();
  const barcodes = new Map<string, Raw[]>();

  const addPark = (p: Raw) => {
    if (parks.has(p.id)) return;
    parks.set(p.id, {
      id: p.id,
      name: p.name ?? '',
      expectedBarcodes: p.expectedBarcodes ?? p.expected_barcodes ?? 0,
      currentBarcodes: p.currentBarcodes ?? p.current_barcodes ?? 0,
      validateBarcodeLength: p.validateBarcodeLength ?? p.validate_barcode_length ?? false,
      archived: p.archived ?? false,
      archivedAt: p.archivedAt ?? p.archived_at ?? null,
      createdAt: toIso(p.createdAt ?? p.created_at, now),
      createdBy: p.createdBy ?? p.userId ?? p.created_by ?? p.user_id ?? '',
    });
  };

  const addRow = (r: Raw, keyParkId?: unknown) => {
    const parkId = r.parkId ?? r.park_id ?? keyParkId;
    if (rows.has(r.id) || typeof parkId !== 'string') return;
    rows.set(r.id, {
      id: r.id,
      parkId,
      name: r.name ?? '',
      expectedBarcodes: r.expectedBarcodes ?? r.expected_barcodes ?? null,
      currentBarcodes: r.currentBarcodes ?? r.current_barcodes ?? 0,
      version: -1, // download again on the first online sync
      createdAt: toIso(r.createdAt ?? r.created_at, now),
    });
  };

  for (const query of queries) {
    if (!isObject(query) || !Array.isArray(query.queryKey)) continue;
    const key = query.queryKey as unknown[];
    const data = isObject(query.state) ? query.state.data : undefined;
    if (data == null) continue;

    if (key[0] === 'parks' && Array.isArray(data)) {
      data.filter(hasId).forEach(addPark);
    } else if (key[0] === 'park' && hasId(data)) {
      addPark(data);
    } else if (key[0] === 'rows' && key[1] === 'park' && Array.isArray(data)) {
      data.filter(hasId).forEach((r) => addRow(r, key[2]));
    } else if (key[0] === 'rows' && key[1] === 'single' && hasId(data)) {
      addRow(data);
    } else if (key[0] === 'barcodes' && key[1] === 'row' && typeof key[2] === 'string' && Array.isArray(data)) {
      barcodes.set(key[2], data.filter((b) => hasId(b) && typeof b.code === 'string'));
    }
  }

  return { parks: [...parks.values()], rows: [...rows.values()], barcodes };
}

function toLocalBarcode(b: Raw, row: LocalRow): LocalBarcode {
  return {
    id: b.id,
    rowId: row.id,
    parkId: row.parkId,
    code: b.code,
    codeKey: codeKey(b.code),
    orderInRow: b.orderInRow ?? Number.MAX_SAFE_INTEGER,
    timestamp: toIso(b.timestamp, row.createdAt),
    userId: b.userId ?? '',
    latitude: b.latitude ?? null,
    longitude: b.longitude ?? null,
    pending: b.isPending ? 1 : 0,
  };
}

// ---------------------------------------------------------------------------
// Removing the old data (only after the new store committed)
// ---------------------------------------------------------------------------

function deleteOldDatabase(factory: IDBFactory): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = factory.deleteDatabase(OLD_DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      // An old tab still holds it open: the delete finishes once that tab closes
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

// ---------------------------------------------------------------------------

export async function migrateLegacyDeviceData(
  options: LegacyMigrationOptions = {}
): Promise<LegacyMigrationResult> {
  const done = await db.meta.get(MIGRATED_KEY);
  if (done?.value === true) return { queued: 0, seededRows: 0 };

  const storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  const factory = options.indexedDB ?? (typeof indexedDB !== 'undefined' ? indexedDB : undefined);

  // 1. Read everything old first: a Dexie transaction must not wait on other promises
  let mutations: QueuedMutation[] = [];
  let oldDbExisted = false;
  if (factory) {
    const oldDb = await openOldDatabase(factory);
    if (oldDb) {
      oldDbExisted = true;
      try {
        mutations = await readAllMutations(oldDb);
      } finally {
        oldDb.close(); // must be closed or deleting it later is blocked
      }
    }
  }
  const converted = sortLikeOldQueue(mutations)
    .map(toOutboxEntry)
    .filter((e): e is OutboxEntry => e !== null);
  const cache = readCache(storage);

  // 2. Write the new store in one transaction
  let queued = 0;
  let seededRows = 0;
  await db.transaction('rw', [db.parks, db.rows, db.barcodes, db.outbox, db.meta], async () => {
    // Outbox: append in old queue order, skipping adds already moved over
    const existing = await db.outbox.toArray();
    const knownAddIds = new Set(
      existing.flatMap((e) => (e.op.type === 'add' || e.op.type === 'insertAt' ? [e.op.barcode.id] : []))
    );
    const toQueue = converted.filter((e) => {
      if (e.op.type !== 'add') return true;
      if (knownAddIds.has(e.op.barcode.id)) return false;
      knownAddIds.add(e.op.barcode.id);
      return true;
    });
    if (toQueue.length) await db.outbox.bulkAdd(toQueue);
    queued = toQueue.length;

    // Parks and rows: only those the new app does not have yet
    const seeded: LocalRow[] = [];
    if (cache) {
      const parkHits = await db.parks.bulkGet(cache.parks.map((p) => p.id));
      const newParks = cache.parks.filter((_, i) => !parkHits[i]);
      if (newParks.length) await db.parks.bulkPut(newParks);

      const rowHits = await db.rows.bulkGet(cache.rows.map((r) => r.id));
      seeded.push(...cache.rows.filter((_, i) => !rowHits[i]));
      if (seeded.length) await db.rows.bulkPut(seeded);
    }
    seededRows = seeded.length;

    // Barcodes of seeded rows: cached server state with the outbox applied on top,
    // so unsent scans show up offline right away
    for (const row of seeded) {
      const cached = (cache?.barcodes.get(row.id) ?? []).map((b) => toLocalBarcode(b, row));
      const taken = await db.barcodes.bulkGet(cached.map((b) => b.id));
      const base = cached.filter((b, i) => !taken[i] || taken[i].rowId === row.id);
      const ops = (await db.outbox.where('rowId').equals(row.id).sortBy('seq'))
        .filter((e) => e.status !== 'failed')
        .map((e) => e.op);
      await db.barcodes.where('rowId').equals(row.id).delete();
      const result = applyOps(base, ops, row.parkId);
      if (result.length) await db.barcodes.bulkPut(result);
    }

    // Rows the new app already has: apply just the newly queued changes on top
    const seededIds = new Set(seeded.map((r) => r.id));
    const newOpsByRow = new Map<string, OutboxOp[]>();
    for (const entry of toQueue) {
      if (seededIds.has(entry.rowId)) continue;
      newOpsByRow.set(entry.rowId, [...(newOpsByRow.get(entry.rowId) ?? []), entry.op]);
    }
    for (const [rowId, ops] of newOpsByRow) {
      const row = await db.rows.get(rowId);
      if (!row) continue; // unknown row: the first sync downloads it with the outbox applied
      const current = await db.barcodes.where('rowId').equals(rowId).toArray();
      const result = applyOps(current, ops, row.parkId);
      await db.barcodes.where('rowId').equals(rowId).delete();
      if (result.length) await db.barcodes.bulkPut(result);
    }

    await db.meta.put({ key: MIGRATED_KEY, value: true });
  });

  // 3. Committed: the old copies are no longer needed
  if (factory && oldDbExisted) await deleteOldDatabase(factory);
  try {
    storage?.removeItem(CACHE_KEY);
  } catch {
    // Storage unavailable: the stale cache is harmless
  }

  return { queued, seededRows };
}
