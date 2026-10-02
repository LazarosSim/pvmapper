import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, type LocalBarcode } from './db';
import { migrateLegacyDeviceData } from './legacy-migration';
import type { QueuedMutation } from '../offline/types';

const OLD_DB = 'pvmapper-offline';
const CACHE_KEY = 'REACT_QUERY_OFFLINE_CACHE';

const PARK = 'park-1';
const ROW = 'row-1';
const ADD_ID = 'mut-add-1';

/** Minimal in-memory Storage */
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
}

const mutations: QueuedMutation[] = [
  // Inserted out of order on purpose: the migration must sort like the old getQueue
  {
    id: 'mut-del-1',
    type: 'DELETE_BARCODE',
    payload: { code: 'B', rowId: ROW, orderInRow: 1, timestamp: '2026-01-01T10:00:03.000Z', localSequence: 3, barcodeId: 'bc-2' },
    createdAt: '2026-01-01T10:00:03.000Z',
    status: 'pending',
  },
  {
    id: ADD_ID,
    type: 'ADD_BARCODE',
    payload: {
      code: 'NEW-1',
      rowId: ROW,
      orderInRow: 2,
      timestamp: '2026-01-01T10:00:01.000Z',
      localSequence: 1,
      userId: 'user-1',
      latitude: 37.9,
      longitude: 23.7,
    },
    createdAt: '2026-01-01T10:00:01.000Z',
    status: 'syncing',
  },
  {
    id: 'mut-upd-1',
    type: 'UPDATE_BARCODE',
    payload: { code: 'A', rowId: ROW, orderInRow: 0, timestamp: '2026-01-01T10:00:01.000Z', localSequence: 2, barcodeId: 'bc-1', newCode: 'A-FIXED' },
    createdAt: '2026-01-01T10:00:02.000Z',
    status: 'failed',
  },
];

function seedOldDatabase(items: QueuedMutation[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OLD_DB, 1);
    request.onupgradeneeded = () => {
      const oldDb = request.result;
      const store = oldDb.createObjectStore('mutations', { keyPath: 'id' });
      store.createIndex('rowId', 'payload.rowId', { unique: false });
      store.createIndex('timestamp', 'payload.timestamp', { unique: false });
      store.createIndex('status', 'status', { unique: false });
      store.createIndex('createdAt', 'createdAt', { unique: false });
      oldDb.createObjectStore('sequences', { keyPath: 'rowId' });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const oldDb = request.result;
      const tx = oldDb.transaction(['mutations'], 'readwrite');
      items.forEach((m) => tx.objectStore('mutations').put(m));
      tx.oncomplete = () => {
        oldDb.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}

const oldDatabaseExists = async () =>
  (await indexedDB.databases()).some((info) => info.name === OLD_DB);

function deleteOldDatabase(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(OLD_DB);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

const cachedPark = {
  id: PARK,
  name: 'Park One',
  createdAt: '2025-12-01T00:00:00.000Z',
  createdBy: 'user-1',
  expectedBarcodes: 100,
  currentBarcodes: 2,
  validateBarcodeLength: true,
  archived: false,
  archivedAt: null,
};

const cachedRow = {
  id: ROW,
  name: 'A1',
  createdAt: '2025-12-02T00:00:00.000Z',
  currentBarcodes: 2,
  expectedBarcodes: 20,
  parkId: PARK,
  park: { name: 'Park One' },
};

const cacheText = () =>
  JSON.stringify({
    buster: '',
    timestamp: Date.now(),
    clientState: {
      mutations: [],
      queries: [
        { queryKey: ['parks', { includeArchived: false }], state: { data: [cachedPark] } },
        // Second shape of the single-park query (userId instead of createdBy)
        {
          queryKey: ['park', 'park-2'],
          state: {
            data: {
              id: 'park-2',
              name: 'Park Two',
              createdAt: '2025-12-03T00:00:00.000Z',
              userId: 'user-2',
              expectedBarcodes: 5,
              currentBarcodes: 0,
              validateBarcodeLength: false,
              archived: false,
              archivedAt: null,
            },
          },
        },
        { queryKey: ['park', PARK], state: { data: cachedPark } },
        { queryKey: ['rows', 'park', PARK], state: { data: [cachedRow] } },
        { queryKey: ['rows', 'single', ROW], state: { data: cachedRow } },
        {
          queryKey: ['barcodes', 'row', ROW],
          state: {
            data: [
              { id: 'bc-1', code: 'A', rowId: ROW, userId: 'user-1', timestamp: '2025-12-05T00:00:00.000Z', orderInRow: 0, latitude: null, longitude: null },
              { id: 'bc-2', code: 'B', rowId: ROW, userId: 'user-1', timestamp: '2025-12-05T00:01:00.000Z', orderInRow: 1, latitude: null, longitude: null },
              // Optimistic entry of the queued add
              { id: ADD_ID, code: 'NEW-1', rowId: ROW, orderInRow: 2, timestamp: '2026-01-01T10:00:01.000Z', isPending: true, localSequence: 1 },
            ],
          },
        },
      ],
    },
  });

const byOrder = (a: LocalBarcode, b: LocalBarcode) => a.orderInRow - b.orderInRow;

let storage: MemoryStorage;

beforeEach(async () => {
  await db.delete();
  await db.open();
  await deleteOldDatabase();
  storage = new MemoryStorage();
});

afterEach(async () => {
  await deleteOldDatabase();
});

describe('migrateLegacyDeviceData', () => {
  it('moves the old queue into the outbox in old upload order', async () => {
    await seedOldDatabase(mutations);
    storage.setItem(CACHE_KEY, cacheText());

    const result = await migrateLegacyDeviceData({ storage });
    expect(result).toEqual({ queued: 3, seededRows: 1 });

    const outbox = await db.outbox.orderBy('seq').toArray();
    expect(outbox.map((e) => e.op.type)).toEqual(['add', 'update', 'delete']);
    expect(outbox.every((e) => e.status === 'pending')).toBe(true);
    expect(outbox.every((e) => e.rowId === ROW)).toBe(true);
    expect(new Set(outbox.map((e) => e.id)).size).toBe(3);
    expect(outbox.map((e) => e.createdAt)).toEqual([
      '2026-01-01T10:00:01.000Z',
      '2026-01-01T10:00:02.000Z',
      '2026-01-01T10:00:03.000Z',
    ]);
    expect(outbox[0].op).toEqual({
      type: 'add',
      barcode: {
        id: ADD_ID,
        rowId: ROW,
        code: 'NEW-1',
        orderInRow: 2,
        timestamp: '2026-01-01T10:00:01.000Z',
        userId: 'user-1',
        latitude: 37.9,
        longitude: 23.7,
      },
    });
    expect(outbox[1].op).toEqual({ type: 'update', id: 'bc-1', code: 'A-FIXED' });
    expect(outbox[2].op).toEqual({ type: 'delete', id: 'bc-2' });
  });

  it('seeds parks, rows and barcodes from the cache with the queue applied', async () => {
    await seedOldDatabase(mutations);
    storage.setItem(CACHE_KEY, cacheText());

    await migrateLegacyDeviceData({ storage });

    const parks = await db.parks.orderBy('id').toArray();
    expect(parks.map((p) => p.id)).toEqual([PARK, 'park-2']);
    expect(parks[0]).toMatchObject({ name: 'Park One', createdBy: 'user-1', expectedBarcodes: 100, validateBarcodeLength: true });
    expect(parks[1].createdBy).toBe('user-2');

    const rows = await db.rows.toArray();
    expect(rows).toEqual([
      { id: ROW, parkId: PARK, name: 'A1', expectedBarcodes: 20, currentBarcodes: 2, version: -1, createdAt: '2025-12-02T00:00:00.000Z' },
    ]);

    const barcodes = (await db.barcodes.where('rowId').equals(ROW).toArray()).sort(byOrder);
    // bc-2 deleted, bc-1 updated, queued add present exactly once
    expect(barcodes.map((b) => [b.id, b.code, b.pending])).toEqual([
      ['bc-1', 'A-FIXED', 1],
      [ADD_ID, 'NEW-1', 1],
    ]);
    expect(barcodes[0].codeKey).toBe('a-fixed');
    expect(barcodes.every((b) => b.parkId === PARK)).toBe(true);
  });

  it('sets the flag and removes the old data after committing', async () => {
    await seedOldDatabase(mutations);
    storage.setItem(CACHE_KEY, cacheText());
    expect(await oldDatabaseExists()).toBe(true);

    await migrateLegacyDeviceData({ storage });

    expect((await db.meta.get('legacyMigrated'))?.value).toBe(true);
    expect(await oldDatabaseExists()).toBe(false);
    expect(storage.getItem(CACHE_KEY)).toBeNull();
  });

  it('changes nothing when run twice', async () => {
    await seedOldDatabase(mutations);
    storage.setItem(CACHE_KEY, cacheText());
    await migrateLegacyDeviceData({ storage });
    const snapshot = {
      outbox: await db.outbox.toArray(),
      barcodes: await db.barcodes.toArray(),
      rows: await db.rows.toArray(),
    };

    // Even if the old data reappeared, the flag stops a second run
    await seedOldDatabase(mutations);
    storage.setItem(CACHE_KEY, cacheText());
    expect(await migrateLegacyDeviceData({ storage })).toEqual({ queued: 0, seededRows: 0 });

    expect(await db.outbox.toArray()).toEqual(snapshot.outbox);
    expect(await db.barcodes.toArray()).toEqual(snapshot.barcodes);
    expect(await db.rows.toArray()).toEqual(snapshot.rows);
  });

  it('does not queue an add twice if the flag was lost', async () => {
    await seedOldDatabase(mutations);
    await migrateLegacyDeviceData({ storage });
    await db.meta.delete('legacyMigrated');

    await seedOldDatabase(mutations);
    await migrateLegacyDeviceData({ storage });

    const adds = (await db.outbox.toArray()).filter((e) => e.op.type === 'add');
    expect(adds).toHaveLength(1);
  });

  it('never overwrites what the new app already downloaded', async () => {
    await db.rows.put({ id: ROW, parkId: PARK, name: 'A1 server', expectedBarcodes: 20, currentBarcodes: 1, version: 7, createdAt: '2025-12-02T00:00:00.000Z' });
    await db.barcodes.put({
      id: 'bc-1', rowId: ROW, parkId: PARK, code: 'A', codeKey: 'a', orderInRow: 0,
      timestamp: '2025-12-05T00:00:00.000Z', userId: 'user-1', pending: 0,
    });
    storage.setItem(CACHE_KEY, cacheText());

    const result = await migrateLegacyDeviceData({ storage });

    expect(result.seededRows).toBe(0);
    const row = await db.rows.get(ROW);
    expect(row).toMatchObject({ name: 'A1 server', version: 7 });
    const barcodes = await db.barcodes.where('rowId').equals(ROW).toArray();
    expect(barcodes.map((b) => b.id)).toEqual(['bc-1']);
  });

  it('does not create the old database when it is missing', async () => {
    expect(await oldDatabaseExists()).toBe(false);

    const result = await migrateLegacyDeviceData({ storage });

    expect(result).toEqual({ queued: 0, seededRows: 0 });
    expect(await oldDatabaseExists()).toBe(false);
    expect((await db.meta.get('legacyMigrated'))?.value).toBe(true);
  });

  it('survives a corrupt cache and still migrates the queue', async () => {
    await seedOldDatabase(mutations);
    storage.setItem(CACHE_KEY, '{not json');

    const result = await migrateLegacyDeviceData({ storage });

    expect(result).toEqual({ queued: 3, seededRows: 0 });
    expect(await db.outbox.count()).toBe(3);
    expect(await db.rows.count()).toBe(0);
    expect(storage.getItem(CACHE_KEY)).toBeNull();
  });
});
