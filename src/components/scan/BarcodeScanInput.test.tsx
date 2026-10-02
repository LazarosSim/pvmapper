// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db, codeKey } from '@/lib/local/db';
import { sortBarcodes } from '@/lib/local/apply-ops';
import BarcodeScanInput from './BarcodeScanInput';

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  loading: vi.fn(() => 'toast-id'),
  dismiss: vi.fn(),
}));

vi.mock('sonner', () => ({ toast }));
vi.mock('@/hooks/use-sound-effects', () => ({
  default: () => ({ playSuccessSound: vi.fn(), playErrorSound: vi.fn() }),
}));
vi.mock('@/lib/supabase-provider', () => ({ useSupabase: () => ({ user: { id: 'user-1' } }) }));

const saved = async (rowId = 'row-1') =>
  sortBarcodes(await db.barcodes.where('rowId').equals(rowId).toArray());

const seed = async ({ validateLength = false, existing = [] as string[] } = {}) => {
  await db.parks.put({
    id: 'park-1', name: 'Park', expectedBarcodes: 0, currentBarcodes: 0, validateBarcodeLength: validateLength,
    archived: false, archivedAt: null, createdAt: '2026-01-01T00:00:00Z', createdBy: 'm',
  });
  for (const id of ['row-1', 'row-2']) {
    await db.rows.put({ id, parkId: 'park-1', name: id === 'row-1' ? 'Row 1' : 'Row 2', expectedBarcodes: null, currentBarcodes: 0, version: 0, createdAt: '' });
  }
  await db.barcodes.bulkPut(existing.map((code, i) => ({
    id: `b-${i}`, rowId: 'row-1', parkId: 'park-1', code, codeKey: codeKey(code), orderInRow: i,
    timestamp: '2026-01-01T00:00:00Z', userId: 'u', pending: 0 as const,
  })));
};

const renderInput = (captureLocation = false, rowIsEmpty = false) => {
  const inputRef = createRef<HTMLInputElement>();
  render(<BarcodeScanInput rowId="row-1" inputRef={inputRef} captureLocation={captureLocation} rowIsEmpty={rowIsEmpty} />);
  return screen.getByPlaceholderText('Scan or enter barcode') as HTMLInputElement;
};

beforeEach(async () => {
  await Promise.all([db.parks.clear(), db.rows.clear(), db.barcodes.clear(), db.outbox.clear()]);
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('BarcodeScanInput', () => {
  it('is ready for the scanner as soon as the page opens', async () => {
    await seed();
    const input = renderInput();
    expect(document.activeElement).toBe(input);
  });

  it('saves fast consecutive scans in order, each at its own position', async () => {
    await seed({ existing: ['EXISTING'] });
    const user = userEvent.setup();
    const input = renderInput();

    // A scanner types each code and presses Enter, without waiting for the save
    await user.type(input, 'AAA{Enter}BBB{Enter}CCC{Enter}');

    await waitFor(async () => expect(await saved()).toHaveLength(4));
    expect((await saved()).map((b) => [b.code, b.orderInRow])).toEqual([
      ['EXISTING', 0],
      ['AAA', 1],
      ['BBB', 2],
      ['CCC', 3],
    ]);
    expect(await db.outbox.count()).toBe(3);
    expect(input.value).toBe('');
  });

  it('rejects a duplicate even with spaces or different case', async () => {
    await seed({ existing: ['ABC123'] });
    const user = userEvent.setup();
    const input = renderInput();

    await user.type(input, '  abc123 {Enter}');

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Duplicate barcode detected'));
    expect(await saved()).toHaveLength(1);
  });

  it('rejects a second scan of a code that is still being saved', async () => {
    await seed();
    const user = userEvent.setup();
    const input = renderInput();

    await user.type(input, 'SAME{Enter}SAME{Enter}');

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Duplicate barcode detected'));
    expect((await saved()).map((b) => b.code)).toEqual(['SAME']);
  });

  it('warns, but saves, a code already scanned in another row of the park', async () => {
    await seed();
    await db.barcodes.put({
      id: 'other', rowId: 'row-2', parkId: 'park-1', code: 'SHARED', codeKey: 'shared', orderInRow: 0,
      timestamp: '', userId: 'u', pending: 0,
    });
    const user = userEvent.setup();
    const input = renderInput();

    await user.type(input, 'SHARED{Enter}');

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('SHARED is also in Row 2'));
    expect((await saved()).map((b) => b.code)).toEqual(['SHARED']);
  });

  it('keeps focus in the input after the placeholder button, so the next Enter scans', async () => {
    await seed();
    const user = userEvent.setup();
    const input = renderInput();

    await user.click(screen.getByRole('button', { name: /placeholder/i }));
    await waitFor(async () => expect(await saved()).toHaveLength(1));
    expect(document.activeElement).toBe(input);

    await user.keyboard('NEXT{Enter}');
    await waitFor(async () => expect(await saved()).toHaveLength(2));
    const codes = (await saved()).map((b) => b.code);
    expect(codes[0]).toMatch(/^X_PLACEHOLDER_/);
    expect(codes[1]).toBe('NEXT');
  });

  it('adds a scan with the Add button as well as with Enter', async () => {
    await seed();
    const user = userEvent.setup();
    const input = renderInput();

    await user.type(input, 'TAPPED');
    await user.click(screen.getByRole('button', { name: /add$/i }));

    await waitFor(async () => expect((await saved()).map((b) => b.code)).toEqual(['TAPPED']));
  });

  it('applies the park length rule', async () => {
    await seed({ validateLength: true });
    const user = userEvent.setup();
    const input = renderInput();

    await user.type(input, 'SHORT{Enter}');

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Barcode must be between 19 and 26 digits')
    );
    expect(await saved()).toHaveLength(0);
  });

  it('records GPS on the first barcode of the row when location capture is on', async () => {
    await seed();
    const getCurrentPosition = vi.fn((resolve: PositionCallback) =>
      resolve({ coords: { latitude: 39.36, longitude: 22.94 } } as GeolocationPosition)
    );
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
    const user = userEvent.setup();
    const input = renderInput(true);

    await user.type(input, 'FIRST{Enter}SECOND{Enter}');

    await waitFor(async () => expect(await saved()).toHaveLength(2));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    const [first, second] = await saved();
    expect(first).toMatchObject({ code: 'FIRST', latitude: 39.36, longitude: 22.94 });
    expect(second.latitude).toBeNull();
  });

  it('asks for GPS when an empty row opens, and the first scan uses that fix', async () => {
    await seed();
    const getCurrentPosition = vi.fn((resolve: PositionCallback) =>
      resolve({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition)
    );
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
    const user = userEvent.setup();
    const input = renderInput(true, true);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);

    await user.type(input, 'FIRST{Enter}');

    await waitFor(async () => expect(await saved()).toHaveLength(1));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect((await saved())[0]).toMatchObject({ latitude: 1, longitude: 2 });
    expect((await screen.findByRole('status')).textContent).toContain('FIRST added');
  });

  it('saves the first scan without GPS when no fix arrives in time', async () => {
    await seed();
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: vi.fn() }, configurable: true });
    const user = userEvent.setup();
    const input = renderInput(true, true);

    await user.type(input, 'FIRST{Enter}');

    await waitFor(async () => expect(await saved()).toHaveLength(1), { timeout: 4000 });
    expect((await saved())[0].latitude).toBeNull();
    expect(toast.warning).toHaveBeenCalled();
  });

  it('shows a rejected scan next to the input', async () => {
    await seed({ existing: ['SAME'] });
    const user = userEvent.setup();
    const input = renderInput();

    await user.type(input, 'same{Enter}');

    expect((await screen.findByRole('status')).textContent).toContain('Duplicate barcode detected');
  });
});
