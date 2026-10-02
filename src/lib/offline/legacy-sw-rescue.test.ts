import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { rescueLegacyServiceWorkerQueue, type RescuedBarcode, type RescueWriter } from './legacy-sw-rescue';

const DB = 'workbox-background-sync';

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).buffer;

// Same layout as Workbox 6's background-sync database
function seedQueue(entries: object[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 3);
    open.onupgradeneeded = () => {
      const store = open.result.createObjectStore('requests', { autoIncrement: true, keyPath: 'id' });
      store.createIndex('queueName', 'queueName', { unique: false });
    };
    open.onsuccess = () => {
      const transaction = open.result.transaction('requests', 'readwrite');
      entries.forEach((entry) => transaction.objectStore('requests').add(entry));
      transaction.oncomplete = () => {
        open.result.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
    open.onerror = () => reject(open.error);
  });
}

function remainingUrls(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB);
    open.onsuccess = () => {
      const request = open.result.transaction('requests').objectStore('requests').getAll();
      request.onsuccess = () => {
        open.result.close();
        resolve(request.result.map((entry: { requestData: { url: string } }) => entry.requestData.url));
      };
      request.onerror = () => reject(request.error);
    };
  });
}

function databaseExists(): Promise<boolean> {
  return indexedDB.databases().then((dbs) => dbs.some((db) => db.name === DB));
}

const recordingWriter = () => {
  const upserted: RescuedBarcode[] = [];
  const inserted: RescuedBarcode[] = [];
  const writer: RescueWriter = {
    upsertWithIds: async (barcodes) => {
      upserted.push(...barcodes);
    },
    insertIfMissing: async (barcode) => {
      inserted.push(barcode);
    },
  };
  return { writer, upserted, inserted };
};

const queued = (url: string, body: unknown, method = 'POST') => ({
  queueName: 'supabaseQueue',
  timestamp: Date.now(),
  requestData: { url, method, body: encode(body) },
});

beforeEach(async () => {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
});

describe('rescueLegacyServiceWorkerQueue', () => {
  it('does nothing, and creates nothing, when the old worker never queued anything', async () => {
    const { writer, upserted } = recordingWriter();
    expect(await rescueLegacyServiceWorkerQueue(writer)).toBe(0);
    expect(upserted).toHaveLength(0);
    expect(await databaseExists()).toBe(false);
  });

  it('uploads queued barcode inserts and leaves every other request untouched', async () => {
    const barcodeUrl = 'https://example.supabase.co/rest/v1/barcodes';
    await seedQueue([
      // Offline sync upload: carries its client-generated id
      queued(barcodeUrl, { id: 'b-1', code: 'C1', row_id: 'r-1', user_id: 'u-1', order_in_row: 4 }),
      // Online-only insert from the row page: no id
      queued(`${barcodeUrl}?select=*`, { code: 'C2', row_id: 'r-1', user_id: 'u-1', order_in_row: 5 }),
      queued('https://example.supabase.co/rest/v1/daily_scans', { user_id: 'u-1', count: 1 }),
      queued('https://example.supabase.co/auth/v1/token?grant_type=refresh_token', { refresh_token: 'x' }),
    ]);

    const { writer, upserted, inserted } = recordingWriter();
    expect(await rescueLegacyServiceWorkerQueue(writer)).toBe(2);

    expect(upserted.map((b) => b.id)).toEqual(['b-1']);
    expect(inserted.map((b) => b.code)).toEqual(['C2']);
    expect((await remainingUrls()).sort()).toEqual([
      'https://example.supabase.co/auth/v1/token?grant_type=refresh_token',
      'https://example.supabase.co/rest/v1/daily_scans',
    ]);
  });

  it('keeps a request queued when the upload fails, to retry later', async () => {
    await seedQueue([
      queued('https://example.supabase.co/rest/v1/barcodes', { id: 'b-2', code: 'C3', row_id: 'r-1', user_id: 'u-1' }),
    ]);

    const writer: RescueWriter = {
      upsertWithIds: async () => {
        throw new Error('network down');
      },
      insertIfMissing: async () => undefined,
    };

    expect(await rescueLegacyServiceWorkerQueue(writer)).toBe(0);
    expect(await remainingUrls()).toHaveLength(1);
  });
});
