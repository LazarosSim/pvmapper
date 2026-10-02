import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  addToQueue,
  getQueue,
  removeQueuedMutationsByRow,
  resetStuckMutations,
  updateMutationStatus,
} from './offline-queue';

const scan = (rowId: string, code: string) => ({
  code,
  rowId,
  orderInRow: 0,
  timestamp: new Date().toISOString(),
  localSequence: 1,
  userId: 'user-1',
});

describe('resetStuckMutations', () => {
  it('puts items left in "syncing" back to "pending" so they are uploaded again', async () => {
    const stuck = await addToQueue('ADD_BARCODE', scan('row-a', 'A1'));
    const waiting = await addToQueue('ADD_BARCODE', scan('row-a', 'A2'));
    await updateMutationStatus(stuck.id, 'syncing');

    expect(await resetStuckMutations()).toBe(1);

    const statuses = Object.fromEntries((await getQueue()).map((m) => [m.id, m.status]));
    expect(statuses[stuck.id]).toBe('pending');
    expect(statuses[waiting.id]).toBe('pending');
  });
});

describe('removeQueuedMutationsByRow', () => {
  it('removes only the given row', async () => {
    await addToQueue('ADD_BARCODE', scan('row-b', 'B1'));
    const other = await addToQueue('ADD_BARCODE', scan('row-c', 'C1'));

    await removeQueuedMutationsByRow('row-b');

    const remaining = await getQueue();
    expect(remaining.some((m) => m.payload.rowId === 'row-b')).toBe(false);
    expect(remaining.some((m) => m.id === other.id)).toBe(true);
  });
});
