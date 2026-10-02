/**
 * Everything the sync engine needs from Supabase, behind one interface so tests can
 * replace it with an in-memory server.
 */
import type { PostgrestError } from '@supabase/supabase-js';
import type { BarcodeData } from './db';

export interface ServerPark {
  id: string;
  name: string;
  expectedBarcodes: number;
  currentBarcodes: number;
  validateBarcodeLength: boolean;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
  createdBy: string;
}

export interface ServerRow {
  id: string;
  parkId: string;
  name: string;
  expectedBarcodes: number | null;
  currentBarcodes: number;
  version: number;
  createdAt: string;
}

export interface ServerApi {
  fetchParks(): Promise<ServerPark[]>;
  fetchRows(parkIds: string[]): Promise<ServerRow[]>;
  fetchBarcodes(rowIds: string[]): Promise<BarcodeData[]>;
  /** Insert; barcodes whose id already exists are skipped */
  insertBarcodes(barcodes: BarcodeData[]): Promise<void>;
  /** Insert at a position, shifting the rest; skipped if the id already exists */
  insertBarcodeAt(barcode: BarcodeData): Promise<void>;
  updateBarcode(id: string, code: string): Promise<void>;
  deleteBarcodes(ids: string[]): Promise<void>;
  resetRow(rowId: string): Promise<void>;
}

/**
 * A failed server call. `permanent` errors will fail the same way on every retry
 * (invalid data, missing row, not allowed); anything else (no connection, timeouts,
 * expired login) is retried later.
 */
export class ServerError extends Error {
  constructor(message: string, readonly permanent: boolean) {
    super(message);
    this.name = 'ServerError';
  }
}

export function toServerError(error: unknown): ServerError {
  if (error instanceof ServerError) return error;
  const pgError = error as Partial<PostgrestError> | undefined;
  const code = pgError?.code ?? '';
  const message = pgError?.message ?? (error instanceof Error ? error.message : String(error));
  // Postgres data (22), integrity (23) and access/syntax (42) errors don't go away on retry
  return new ServerError(message, /^(22|23|42)/.test(code));
}
