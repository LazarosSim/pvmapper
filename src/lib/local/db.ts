/**
 * The phone's own copy of the data: every active park with its rows and barcodes,
 * plus the outbox of changes waiting to be uploaded. Screens read from here, so the
 * app works the same with or without a connection.
 */
import Dexie, { type Table } from 'dexie';

export interface LocalPark {
  id: string;
  name: string;
  expectedBarcodes: number;
  /** Server count; for active parks screens count the local barcodes instead */
  currentBarcodes: number;
  validateBarcodeLength: boolean;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
  createdBy: string;
}

export interface LocalRow {
  id: string;
  parkId: string;
  name: string;
  expectedBarcodes: number | null;
  currentBarcodes: number;
  /** Server version of the row; -1 when it must be downloaded again */
  version: number;
  createdAt: string;
}

export interface LocalBarcode {
  id: string;
  rowId: string;
  parkId: string;
  code: string;
  /** Lowercase, trimmed code used for duplicate checks */
  codeKey: string;
  orderInRow: number;
  timestamp: string;
  userId: string;
  latitude?: number | null;
  longitude?: number | null;
  /** 1 while the change that created or edited it is not uploaded yet */
  pending: 0 | 1;
}

export interface BarcodeData {
  id: string;
  rowId: string;
  code: string;
  orderInRow: number;
  timestamp: string;
  userId: string;
  latitude?: number | null;
  longitude?: number | null;
}

export type OutboxOp =
  | { type: 'add'; barcode: BarcodeData }
  | { type: 'insertAt'; barcode: BarcodeData }
  | { type: 'update'; id: string; code: string }
  | { type: 'delete'; id: string }
  | { type: 'resetRow' };

export type OutboxStatus = 'pending' | 'sending' | 'failed';

export interface OutboxEntry {
  seq?: number;
  id: string;
  rowId: string;
  op: OutboxOp;
  status: OutboxStatus;
  error?: string;
  createdAt: string;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

export class LocalDB extends Dexie {
  parks!: Table<LocalPark, string>;
  rows!: Table<LocalRow, string>;
  barcodes!: Table<LocalBarcode, string>;
  outbox!: Table<OutboxEntry, number>;
  meta!: Table<MetaEntry, string>;

  constructor(name = 'pvmapper-local') {
    super(name);
    this.version(1).stores({
      parks: 'id',
      rows: 'id, parkId',
      barcodes: 'id, rowId, parkId, [rowId+orderInRow], [parkId+codeKey]',
      outbox: '++seq, &id, rowId, status',
      meta: 'key',
    });
    // Counting barcodes per park and row from the indexes, without reading every barcode
    this.version(2).stores({
      barcodes: 'id, rowId, parkId, [rowId+orderInRow], [parkId+codeKey], [parkId+pending], [rowId+pending]',
    });
  }
}

export const db = new LocalDB();

export const codeKey = (code: string) => code.trim().toLowerCase();

export const isPlaceholderCode = (code: string) => code.startsWith('X_PLACEHOLDER_');
