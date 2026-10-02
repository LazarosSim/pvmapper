/**
 * Rescue of scans held by the previous hand-written service worker.
 *
 * When a request to Supabase failed, that worker answered with a fake "201 Created" and
 * parked the request in Workbox's background-sync queue. The app then treated the write
 * as done: a synced scan was removed from the offline queue even though it never
 * reached the server. The generated service worker that replaced it doesn't replay that
 * queue, so barcode inserts found there are written to the server here.
 *
 * Everything else in that queue (row inserts the user never saw succeed, stats counters,
 * order shifts, auth token refreshes) is left untouched: replaying it would be unsafe.
 */

const WORKBOX_DB = 'workbox-background-sync';
const STORE = 'requests';
const QUEUE_NAME = 'supabaseQueue';
const BARCODES_PATH = '/rest/v1/barcodes';

interface StoredRequest {
  id: number;
  queueName: string;
  requestData: {
    url: string;
    method?: string;
    body?: ArrayBuffer | ArrayBufferView | string;
  };
}

export interface RescuedBarcode {
  id?: string;
  code: string;
  row_id: string;
  user_id: string;
  order_in_row?: number | null;
  timestamp?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface RescueWriter {
  /** Insert barcodes that carry their client-generated id; ids already on the server are skipped. */
  upsertWithIds(barcodes: RescuedBarcode[]): Promise<void>;
  /** Insert a barcode without an id unless the row already has that code. */
  insertIfMissing(barcode: RescuedBarcode): Promise<void>;
}

/** Opens the Workbox database only if it already exists; never creates it. */
function openExistingDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const request = indexedDB.open(WORKBOX_DB);
    request.onupgradeneeded = () => request.transaction?.abort();
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.close();
        resolve(null);
        return;
      }
      resolve(db);
    };
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function readQueuedRequests(db: IDBDatabase): Promise<StoredRequest[]> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () =>
      resolve((request.result as StoredRequest[]).filter((entry) => entry.queueName === QUEUE_NAME));
    request.onerror = () => reject(request.error);
  });
}

function deleteQueuedRequest(db: IDBDatabase, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/** Barcode records in a queued POST to the barcodes table, or null for any other request. */
export function parseBarcodeInsert(entry: StoredRequest): RescuedBarcode[] | null {
  const { url, method, body } = entry.requestData;
  if ((method ?? 'POST').toUpperCase() !== 'POST' || body === undefined) return null;

  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  if (path !== BARCODES_PATH) return null;

  try {
    const text = typeof body === 'string' ? body : new TextDecoder().decode(body);
    const parsed = JSON.parse(text);
    return (Array.isArray(parsed) ? parsed : [parsed]) as RescuedBarcode[];
  } catch {
    return null;
  }
}

const isComplete = (barcode: RescuedBarcode) =>
  !!barcode && !!barcode.code && !!barcode.row_id && !!barcode.user_id;

let inFlight: Promise<number> | null = null;

/**
 * Write rescued barcodes to the server and remove their requests from the old queue.
 * Returns the number of barcodes sent. A request that fails stays queued for the next attempt.
 */
export function rescueLegacyServiceWorkerQueue(writer: RescueWriter): Promise<number> {
  if (!inFlight) {
    inFlight = runRescue(writer).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runRescue(writer: RescueWriter): Promise<number> {
  const db = await openExistingDb();
  if (!db) return 0;

  let rescued = 0;
  try {
    for (const entry of await readQueuedRequests(db)) {
      const barcodes = parseBarcodeInsert(entry);
      // Anything that isn't a complete barcode insert is left where it is
      if (!barcodes || barcodes.length === 0 || !barcodes.every(isComplete)) continue;

      try {
        const withIds = barcodes.filter((barcode) => barcode.id);
        if (withIds.length > 0) await writer.upsertWithIds(withIds);
        for (const barcode of barcodes.filter((b) => !b.id)) {
          await writer.insertIfMissing(barcode);
        }
        await deleteQueuedRequest(db, entry.id);
        rescued += barcodes.length;
      } catch (error) {
        console.error('[LegacyRescue] Could not restore queued barcodes, will retry later:', error);
      }
    }
  } finally {
    db.close();
  }

  if (rescued > 0) console.log(`[LegacyRescue] Restored ${rescued} barcode(s) from the old service worker queue`);
  return rescued;
}
