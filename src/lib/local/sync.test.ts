import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { sortBarcodes } from './apply-ops';
import { FakeServer } from './fake-server';
import {
  addBarcodeToRow,
  addScan,
  deleteBarcode,
  insertBarcodeAfter,
  resetRow,
  updateBarcode,
} from './repo';
import { configureSync, syncNow } from './sync';

let server: FakeServer;

const localCodes = async (rowId: string) =>
  sortBarcodes(await db.barcodes.where('rowId').equals(rowId).toArray()).map((b) => b.code);

const scan = (code: string, rowId = 'row-1') => addScan({ rowId, code, userId: 'worker' });

beforeEach(async () => {
  await Promise.all([db.parks.clear(), db.rows.clear(), db.barcodes.clear(), db.outbox.clear(), db.meta.clear()]);
  server = new FakeServer();
  server.addPark({ id: 'park-1', validateBarcodeLength: false });
  server.addPark({ id: 'old-park', archived: true });
  server.addRow({ id: 'row-1', parkId: 'park-1', name: 'Row 1' });
  server.addRow({ id: 'row-2', parkId: 'park-1', name: 'Row 2' });
  server.addRow({ id: 'old-row', parkId: 'old-park' });
  server.putBarcode({ id: 's-1', rowId: 'row-1', code: 'EXISTING', orderInRow: 0, timestamp: '2026-01-01T00:00:00Z', userId: 'u' });
  configureSync(server);
  await syncNow();
});

describe('download', () => {
  it('keeps a copy of every active park, but not archived parks\' rows', async () => {
    expect((await db.parks.toArray()).map((p) => p.id).sort()).toEqual(['old-park', 'park-1']);
    expect((await db.rows.toArray()).map((r) => r.id).sort()).toEqual(['row-1', 'row-2']);
    expect(await localCodes('row-1')).toEqual(['EXISTING']);
  });

  it('downloads only rows whose version changed', async () => {
    server.putBarcode({ id: 's-2', rowId: 'row-2', code: 'FROM-OTHER-PHONE', orderInRow: 0, timestamp: '2026-01-02T00:00:00Z', userId: 'u' });
    server.calls = [];
    await syncNow();
    expect(server.calls.filter((c) => c === 'fetchBarcodes')).toHaveLength(1);
    expect(await localCodes('row-2')).toEqual(['FROM-OTHER-PHONE']);

    server.calls = [];
    await syncNow();
    expect(server.calls).not.toContain('fetchBarcodes');
  });

  it('removes rows deleted on the server', async () => {
    server.rows.delete('row-2');
    await syncNow();
    expect(await db.rows.get('row-2')).toBeUndefined();
  });
});

describe('scanning offline and syncing later', () => {
  it('shows scans immediately and uploads them in one batch when back online', async () => {
    server.online = false;
    for (const code of ['A', 'B', 'C']) expect((await scan(code)).ok).toBe(true);

    expect(await localCodes('row-1')).toEqual(['EXISTING', 'A', 'B', 'C']);
    await expect(syncNow()).rejects.toThrow();
    expect(await db.outbox.count()).toBe(3);

    server.online = true;
    server.calls = [];
    await syncNow();
    expect(server.calls.filter((c) => c.startsWith('insertBarcodes'))).toEqual(['insertBarcodes:3']);
    expect(server.rowCodes('row-1')).toEqual(['EXISTING', 'A', 'B', 'C']);
    expect(await db.outbox.count()).toBe(0);
    expect((await db.barcodes.where('rowId').equals('row-1').toArray()).every((b) => b.pending === 0)).toBe(true);
  });

  it('rejects a duplicate in the row and warns about one in another row', async () => {
    expect(await scan(' existing ')).toEqual({ ok: false, reason: 'duplicate' });
    const result = await scan('EXISTING', 'row-2');
    expect(result.ok && result.alsoInRows).toEqual(['Row 1']);
  });

  it('applies the park length rule', async () => {
    await db.parks.update('park-1', { validateBarcodeLength: true });
    expect(await scan('SHORT')).toEqual({ ok: false, reason: 'length' });
    expect((await scan('1'.repeat(20))).ok).toBe(true);
  });

  it('keeps scans made while a download is running', async () => {
    server.putBarcode({ id: 's-3', rowId: 'row-1', code: 'REMOTE', orderInRow: 1, timestamp: '2026-01-02T00:00:00Z', userId: 'u' });
    server.online = false;
    await scan('LOCAL');
    server.online = true;
    // Download happens while LOCAL is still in the outbox: it must survive the row refresh
    const original = server.insertBarcodes.bind(server);
    server.insertBarcodes = async () => {
      throw Object.assign(new Error('timeout'), { code: '' });
    };
    await expect(syncNow()).rejects.toThrow();
    server.insertBarcodes = original;
    await syncNow();
    expect(server.rowCodes('row-1').sort()).toEqual(['EXISTING', 'LOCAL', 'REMOTE']);
    expect((await localCodes('row-1')).sort()).toEqual(['EXISTING', 'LOCAL', 'REMOTE']);
  });
});

describe('edits', () => {
  it('edits, inserts and deletes offline, and the server ends up identical', async () => {
    server.online = false;
    await scan('A');
    await scan('B');
    const existing = (await db.barcodes.get('s-1'))!;
    await insertBarcodeAfter(existing, 'INSERTED', 'worker');
    await updateBarcode('row-1', 's-1', 'EXISTING-FIXED');
    const b = (await db.barcodes.toArray()).find((x) => x.code === 'B')!;
    await deleteBarcode('row-1', b.id);

    const expected = ['EXISTING-FIXED', 'INSERTED', 'A'];
    expect(await localCodes('row-1')).toEqual(expected);

    server.online = true;
    await syncNow();
    expect(server.rowCodes('row-1')).toEqual(expected);
    expect(await localCodes('row-1')).toEqual(expected);
  });

  it('a scan deleted before upload is never sent', async () => {
    server.online = false;
    const result = await scan('OOPS');
    await deleteBarcode('row-1', result.ok ? result.barcode.id : '');
    expect(await db.outbox.count()).toBe(0);
  });

  it('reset row clears server and unsent scans', async () => {
    server.online = false;
    await scan('A');
    expect(await resetRow('row-1')).toBe(2);
    await scan('AFTER-RESET');
    server.online = true;
    await syncNow();
    expect(server.rowCodes('row-1')).toEqual(['AFTER-RESET']);
  });

  it('adds to the end of rows from the row page', async () => {
    await addBarcodeToRow('row-2', ' MANUAL ', 'manager');
    await syncNow();
    expect(server.rowCodes('row-2')).toEqual(['MANUAL']);
  });
});

describe('refused changes', () => {
  it('sets aside a change the server refuses and uploads the rest', async () => {
    server.online = false;
    await scan('GOOD-1');
    await scan('BAD', 'row-2');
    await scan('GOOD-2');
    // row-2 deleted by a manager while this phone was offline
    server.rows.delete('row-2');

    server.online = true;
    await syncNow();
    expect(server.rowCodes('row-1')).toEqual(['EXISTING', 'GOOD-1', 'GOOD-2']);
    const failed = await db.outbox.where('status').equals('failed').toArray();
    expect(failed).toHaveLength(1);
    expect(failed[0].op.type === 'add' && failed[0].op.barcode.code).toBe('BAD');
  });
});
