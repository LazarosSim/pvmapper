/**
 * In-memory stand-in for the Supabase server, with the same row-version and ordering
 * behaviour as the database (see supabase/migrations/20261002033100_row_versions_and_stats.sql).
 * Used by tests only.
 */
import type { BarcodeData } from './db';
import { ServerError, type ServerApi, type ServerPark, type ServerRow } from './server';

export class FakeServer implements ServerApi {
  parks = new Map<string, ServerPark>();
  rows = new Map<string, ServerRow>();
  barcodes = new Map<string, BarcodeData>();
  online = true;
  /** Requests made, for asserting batching */
  calls: string[] = [];

  addPark(park: Partial<ServerPark> & { id: string }) {
    this.parks.set(park.id, {
      name: park.id,
      expectedBarcodes: 0,
      currentBarcodes: 0,
      validateBarcodeLength: false,
      archived: false,
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      createdBy: 'manager',
      ...park,
    });
  }

  addRow(row: Partial<ServerRow> & { id: string; parkId: string }) {
    this.rows.set(row.id, {
      name: row.id,
      expectedBarcodes: null,
      currentBarcodes: 0,
      version: 0,
      createdAt: '2026-01-01T00:00:00Z',
      ...row,
    });
  }

  /** Simulates another phone or the server changing a row's barcodes */
  putBarcode(barcode: BarcodeData) {
    this.barcodes.set(barcode.id, barcode);
    this.touch(barcode.rowId);
  }

  private touch(rowId: string) {
    const row = this.rows.get(rowId);
    if (!row) return;
    const count = [...this.barcodes.values()].filter((b) => b.rowId === rowId).length;
    this.rows.set(rowId, { ...row, currentBarcodes: count, version: row.version + 1 });
  }

  private check(call: string) {
    this.calls.push(call);
    if (!this.online) throw new ServerError('Failed to fetch', false);
  }

  async fetchParks() {
    this.check('fetchParks');
    return [...this.parks.values()];
  }

  async fetchRows(parkIds: string[]) {
    this.check('fetchRows');
    return [...this.rows.values()].filter((r) => parkIds.includes(r.parkId));
  }

  async fetchBarcodes(rowIds: string[]) {
    this.check('fetchBarcodes');
    return [...this.barcodes.values()].filter((b) => rowIds.includes(b.rowId));
  }

  async insertBarcodes(barcodes: BarcodeData[]) {
    this.check(`insertBarcodes:${barcodes.length}`);
    for (const b of barcodes) {
      if (!this.rows.has(b.rowId)) {
        throw Object.assign(new Error('violates foreign key constraint'), { code: '23503' });
      }
    }
    for (const b of barcodes) {
      if (!this.barcodes.has(b.id)) this.putBarcode(b);
    }
  }

  async insertBarcodeAt(b: BarcodeData) {
    this.check('insertBarcodeAt');
    if (this.barcodes.has(b.id)) return;
    for (const other of this.barcodes.values()) {
      if (other.rowId === b.rowId && other.orderInRow >= b.orderInRow) {
        this.barcodes.set(other.id, { ...other, orderInRow: other.orderInRow + 1 });
      }
    }
    this.putBarcode(b);
  }

  async updateBarcode(id: string, code: string) {
    this.check('updateBarcode');
    const existing = this.barcodes.get(id);
    if (existing) this.putBarcode({ ...existing, code });
  }

  async deleteBarcodes(ids: string[]) {
    this.check(`deleteBarcodes:${ids.length}`);
    for (const id of ids) {
      const existing = this.barcodes.get(id);
      if (existing) {
        this.barcodes.delete(id);
        this.touch(existing.rowId);
      }
    }
  }

  async resetRow(rowId: string) {
    this.check('resetRow');
    for (const [id, b] of this.barcodes) if (b.rowId === rowId) this.barcodes.delete(id);
    this.touch(rowId);
  }

  rowCodes(rowId: string) {
    return [...this.barcodes.values()]
      .filter((b) => b.rowId === rowId)
      .sort((a, b) => a.orderInRow - b.orderInRow)
      .map((b) => b.code);
  }
}
