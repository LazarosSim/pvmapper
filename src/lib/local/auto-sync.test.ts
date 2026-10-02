// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import { db } from './db';
import { FakeServer } from './fake-server';
import { addScan } from './repo';
import { configureSync, startAutoSync, syncNow } from './sync';

let stop: () => void = () => undefined;
afterEach(() => stop());

it('uploads a scan shortly after it is made, without downloading everything again', async () => {
  await Promise.all([db.parks.clear(), db.rows.clear(), db.barcodes.clear(), db.outbox.clear()]);
  const server = new FakeServer();
  server.addPark({ id: 'park-1' });
  server.addRow({ id: 'row-1', parkId: 'park-1' });
  configureSync(server);
  await syncNow();
  stop = startAutoSync();
  // The start of auto sync runs one full sync; wait for it
  await waitFor(() => expect(server.calls).toContain('fetchParks'));
  await syncNow();
  server.calls = [];

  await addScan({ rowId: 'row-1', code: 'NEW', userId: 'worker' });

  await waitFor(() => expect(server.calls).toContain('insertBarcodes:1'), { timeout: 4000 });
  expect(server.calls).not.toContain('fetchParks');
  expect(server.calls).not.toContain('fetchRows');
  expect([...server.barcodes.values()].map((b) => b.code)).toEqual(['NEW']);
  expect((await db.barcodes.toArray())[0].pending).toBe(0);
});
