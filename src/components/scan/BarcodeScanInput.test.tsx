// @vitest-environment jsdom
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BarcodeScanInput from './BarcodeScanInput';

type Saved = { code: string; orderInRow: number; latitude?: number; longitude?: number };

const state = vi.hoisted(() => ({
  existing: [] as { id: string; code: string; orderInRow: number }[],
  validateLength: false,
  saved: [] as Saved[],
  addDelayMs: 0,
}));

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  loading: vi.fn(() => 'toast-id'),
  dismiss: vi.fn(),
}));

vi.mock('sonner', () => ({ toast }));
vi.mock('@/lib/db-provider', () => ({ useDB: () => ({ getParkById: () => undefined }) }));
vi.mock('@/hooks/use-sound-effects', () => ({
  default: () => ({ playSuccessSound: vi.fn(), playErrorSound: vi.fn() }),
}));
vi.mock('@/lib/supabase-provider', () => ({ useSupabase: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/hooks/use-row-queries.tsx', () => ({
  useRow: () => ({ data: { id: 'row-1', parkId: 'park-1', name: 'Row 1' } }),
}));
vi.mock('@/hooks/parks', () => ({
  useParkById: () => ({ data: { validateBarcodeLength: state.validateLength } }),
}));
vi.mock('@/hooks/use-barcodes-queries.tsx', () => ({ useRowBarcodes: () => ({ data: undefined }) }));
vi.mock('@/hooks/use-offline-barcodes', () => ({
  // The merged list does not update during the test, like the real one lagging behind fast scans
  useMergedBarcodes: () => ({ mergedBarcodes: state.existing }),
  useOfflineAddBarcode: () => ({
    addBarcode: async (code: string, orderInRow: number, _ts: string, latitude?: number, longitude?: number) => {
      if (state.addDelayMs) await new Promise((resolve) => setTimeout(resolve, state.addDelayMs));
      state.saved.push({ code, orderInRow, latitude, longitude });
      return { id: `m-${state.saved.length}` };
    },
  }),
}));

const renderInput = (captureLocation = false) => {
  const inputRef = createRef<HTMLInputElement>();
  render(<BarcodeScanInput rowId="row-1" inputRef={inputRef} captureLocation={captureLocation} />);
  return screen.getByPlaceholderText('Scan or enter barcode') as HTMLInputElement;
};

beforeEach(() => {
  state.existing = [];
  state.validateLength = false;
  state.saved = [];
  state.addDelayMs = 0;
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('BarcodeScanInput', () => {
  it('is ready for the scanner as soon as the page opens', () => {
    const input = renderInput();
    expect(document.activeElement).toBe(input);
  });

  it('saves fast consecutive scans in order, each at its own position', async () => {
    state.existing = [{ id: 'b-0', code: 'EXISTING', orderInRow: 0 }];
    state.addDelayMs = 20;
    const user = userEvent.setup();
    const input = renderInput();

    // A scanner types each code and presses Enter, without waiting for the save
    await user.type(input, 'AAA{Enter}BBB{Enter}CCC{Enter}');

    await waitFor(() => expect(state.saved).toHaveLength(3));
    expect(state.saved.map((s) => [s.code, s.orderInRow])).toEqual([
      ['AAA', 1],
      ['BBB', 2],
      ['CCC', 3],
    ]);
    expect(input.value).toBe('');
  });

  it('rejects a duplicate even with spaces or different case', async () => {
    state.existing = [{ id: 'b-0', code: 'ABC123', orderInRow: 0 }];
    const user = userEvent.setup();
    const input = renderInput();

    await user.type(input, '  abc123 {Enter}');

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Duplicate barcode detected'));
    expect(state.saved).toHaveLength(0);
  });

  it('rejects a second scan of a code that is still being saved', async () => {
    state.addDelayMs = 20;
    const user = userEvent.setup();
    const input = renderInput();

    await user.type(input, 'SAME{Enter}SAME{Enter}');

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Duplicate barcode detected'));
    expect(state.saved.map((s) => s.code)).toEqual(['SAME']);
  });

  it('keeps focus in the input after the placeholder button, so the next Enter scans', async () => {
    const user = userEvent.setup();
    const input = renderInput();

    await user.click(screen.getByRole('button', { name: /placeholder/i }));
    await waitFor(() => expect(state.saved).toHaveLength(1));
    expect(document.activeElement).toBe(input);

    await user.keyboard('NEXT{Enter}');
    await waitFor(() => expect(state.saved).toHaveLength(2));
    expect(state.saved[0].code).toMatch(/^X_PLACEHOLDER_/);
    expect(state.saved[1].code).toBe('NEXT');
  });

  it('adds a scan with the Add button as well as with Enter', async () => {
    const user = userEvent.setup();
    const input = renderInput();

    await user.type(input, 'TAPPED');
    await user.click(screen.getByRole('button', { name: /add$/i }));

    await waitFor(() => expect(state.saved.map((s) => s.code)).toEqual(['TAPPED']));
  });

  it('applies the park length rule', async () => {
    state.validateLength = true;
    const user = userEvent.setup();
    const input = renderInput();

    await user.type(input, 'SHORT{Enter}');

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Barcode must be between 19 and 26 digits')
    );
    expect(state.saved).toHaveLength(0);
  });

  it('records GPS on the first barcode of the row when location capture is on', async () => {
    const getCurrentPosition = vi.fn((resolve: PositionCallback) =>
      resolve({ coords: { latitude: 39.36, longitude: 22.94 } } as GeolocationPosition)
    );
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
    const user = userEvent.setup();
    const input = renderInput(true);

    await user.type(input, 'FIRST{Enter}SECOND{Enter}');

    await waitFor(() => expect(state.saved).toHaveLength(2));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(state.saved[0]).toMatchObject({ code: 'FIRST', latitude: 39.36, longitude: 22.94 });
    expect(state.saved[1].latitude).toBeUndefined();
  });
});
