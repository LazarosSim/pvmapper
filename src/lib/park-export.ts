/**
 * Builds the park Excel exports. The sheet layout is unchanged from the original
 * ExportDialog; data now comes from the phone's copy (active parks, after a sync) or
 * from the server (archived parks).
 */
import type * as XLSXModule from 'xlsx';
import { db } from '@/lib/local/db';
import { sortBarcodes } from '@/lib/local/apply-ops';
import { supabaseServer } from '@/lib/local/supabase-server';
import { syncNow } from '@/lib/local/sync';
import { ensureUniqueSheetName, naturalCompare, sortWorksheetEntries, toSafeSheetName, type WorksheetEntry } from '@/lib/utils';

type XLSX = typeof XLSXModule;

export type ExportMode = 'standard' | 'metlen';

export interface ExportPark {
  id: string;
  name: string;
  createdAt: string | Date;
  expectedBarcodes: number;
  archived: boolean;
}

export interface ExportRow {
  id: string;
  name: string;
  expectedBarcodes: number | null;
  currentBarcodes: number | null;
}

export interface ParkExportData {
  rows: ExportRow[];
  /** Codes of each row, in row order */
  codesByRow: Map<string, string[]>;
  totalBarcodes: number;
  /** Scans on this phone that could not be uploaded before the export */
  unsentCount: number;
}

/** Everything the export needs, in natural row order. */
export async function loadParkExportData(park: ExportPark): Promise<ParkExportData> {
  if (!park.archived) {
    // Upload this phone's scans first so the file matches the server; works offline too
    if (navigator.onLine) await syncNow().catch(() => undefined);
    const [rows, barcodes] = await Promise.all([
      db.rows.where('parkId').equals(park.id).toArray(),
      db.barcodes.where('parkId').equals(park.id).toArray(),
    ]);
    const codesByRow = new Map<string, string[]>();
    for (const row of rows) {
      codesByRow.set(row.id, sortBarcodes(barcodes.filter((b) => b.rowId === row.id)).map((b) => b.code));
    }
    return {
      rows: rows
        .map((r) => ({ id: r.id, name: r.name, expectedBarcodes: r.expectedBarcodes, currentBarcodes: codesByRow.get(r.id)!.length }))
        .sort((a, b) => naturalCompare(a.name, b.name)),
      codesByRow,
      totalBarcodes: barcodes.length,
      unsentCount: barcodes.filter((b) => b.pending).length,
    };
  }

  const rows = await supabaseServer.fetchRows([park.id]);
  const barcodes = await supabaseServer.fetchBarcodes(rows.map((r) => r.id));
  const codesByRow = new Map<string, string[]>();
  for (const row of rows) {
    codesByRow.set(row.id, sortBarcodes(barcodes.filter((b) => b.rowId === row.id)).map((b) => b.code));
  }
  return {
    rows: rows
      .map((r) => ({ id: r.id, name: r.name, expectedBarcodes: r.expectedBarcodes, currentBarcodes: r.currentBarcodes }))
      .sort((a, b) => naturalCompare(a.name, b.name)),
    codesByRow,
    totalBarcodes: barcodes.length,
    unsentCount: 0,
  };
}

export const progressPercent = (park: ExportPark, totalBarcodes: number): string => {
  const value = park.expectedBarcodes > 0 ? (totalBarcodes / park.expectedBarcodes) * 100 : 0;
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
};

function buildSummarySheet(XLSX: XLSX, park: ExportPark, data: ParkExportData) {
  const summaryData = [
    ['Park Name', park.name],
    ['Created', new Date(park.createdAt).toLocaleString()],
    ['Total Rows', data.rows.length.toString()],
    ['Total Barcodes', data.totalBarcodes.toString()],
    ['Expected Barcodes', park.expectedBarcodes.toString()],
    ['Completion', `${progressPercent(park, data.totalBarcodes)}%`],
  ];

  data.rows.forEach((row, index) => {
    summaryData.push([
      `Row ${index + 1}`,
      row.name,
      `Expected: ${row.expectedBarcodes || 'N/A'}`,
      `Current: ${row.currentBarcodes || 0}`,
    ]);
  });

  return XLSX.utils.aoa_to_sheet(summaryData);
}

/** Standard: a Summary tab, then one tab per row with its barcodes. */
function buildStandard(XLSX: XLSX, park: ExportPark, data: ParkExportData) {
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  const worksheets: WorksheetEntry[] = [];

  const summaryName = ensureUniqueSheetName('Summary', usedNames);
  worksheets.push({ originalName: 'Summary', sheetName: summaryName, type: 'summary', worksheet: buildSummarySheet(XLSX, park, data) });

  for (const row of data.rows) {
    const rowData = [['Barcode'], ...(data.codesByRow.get(row.id) ?? []).map((code) => [code || ''])];
    const safeName = ensureUniqueSheetName(toSafeSheetName(row.name), usedNames);
    worksheets.push({ originalName: row.name, sheetName: safeName, type: 'row', worksheet: XLSX.utils.aoa_to_sheet(rowData) });
  }

  sortWorksheetEntries(worksheets).forEach(({ sheetName, worksheet }) => {
    XLSX.utils.book_append_sheet(wb, worksheet, sheetName);
  });
  return wb;
}

/** Metlen: a Summary tab and every barcode in one sheet. */
function buildMetlen(XLSX: XLSX, park: ExportPark, data: ParkExportData) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(XLSX, park, data), 'Summary');

  const barcodesData: (string | number)[][] = [['A/A', 'ROW NAME', 'STRING NAME', 'SERIAL NUMBER']];
  for (const row of data.rows) {
    (data.codesByRow.get(row.id) ?? []).forEach((code, index) => {
      barcodesData.push([
        index + 1,       // A/A — resets per row
        row.name,        // ROW NAME
        '',              // STRING NAME (empty)
        code || '',      // SERIAL NUMBER
      ]);
    });
  }

  const barcodesWs = XLSX.utils.aoa_to_sheet(barcodesData);
  barcodesWs['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 20 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, barcodesWs, 'Barcodes');
  return wb;
}

export function buildWorkbook(XLSX: XLSX, mode: ExportMode, park: ExportPark, data: ParkExportData) {
  return mode === 'standard' ? buildStandard(XLSX, park, data) : buildMetlen(XLSX, park, data);
}

export const exportFileName = (park: ExportPark, mode: ExportMode, date = new Date()) =>
  `${park.name}_${mode === 'metlen' ? 'Metlen_' : ''}${date.toISOString().split('T')[0]}.xlsx`.replace(/[\\/:*?"<>|]/g, '_');
