// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildWorkbook, exportFileName, type ExportPark, type ParkExportData } from './park-export';

const park: ExportPark = {
  id: 'p', name: 'KL 59', createdAt: '2026-01-01T10:00:00Z', expectedBarcodes: 10, archived: false,
};

// Rows already in natural order, as loadParkExportData returns them
const data: ParkExportData = {
  rows: [
    { id: 'r2', name: 'Row 2', expectedBarcodes: 3, currentBarcodes: 2 },
    { id: 'r10', name: 'Row 10', expectedBarcodes: null, currentBarcodes: 1 },
  ],
  codesByRow: new Map([
    ['r2', ['A1', 'A2']],
    ['r10', ['B1']],
  ]),
  totalBarcodes: 3,
  unsentCount: 0,
};

const sheet = (wb: XLSX.WorkBook, name: string) =>
  XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1 });

describe('park export', () => {
  it('Standard: Summary first, then one tab per row in natural order', () => {
    const wb = buildWorkbook(XLSX, 'standard', park, data);
    expect(wb.SheetNames).toEqual(['Summary', 'Row_2', 'Row_10']);
    expect(sheet(wb, 'Row_2')).toEqual([['Barcode'], ['A1'], ['A2']]);
    expect(sheet(wb, 'Row_10')).toEqual([['Barcode'], ['B1']]);

    const summary = sheet(wb, 'Summary');
    expect(summary[0]).toEqual(['Park Name', 'KL 59']);
    expect(summary.slice(2)).toEqual([
      ['Total Rows', '2'],
      ['Total Barcodes', '3'],
      ['Expected Barcodes', '10'],
      ['Completion', '30.00%'],
      ['Row 1', 'Row 2', 'Expected: 3', 'Current: 2'],
      ['Row 2', 'Row 10', 'Expected: N/A', 'Current: 1'],
    ]);
  });

  it('Metlen: Summary and one Barcodes sheet, numbering restarting per row', () => {
    const wb = buildWorkbook(XLSX, 'metlen', park, data);
    expect(wb.SheetNames).toEqual(['Summary', 'Barcodes']);
    expect(sheet(wb, 'Barcodes')).toEqual([
      ['A/A', 'ROW NAME', 'STRING NAME', 'SERIAL NUMBER'],
      [1, 'Row 2', '', 'A1'],
      [2, 'Row 2', '', 'A2'],
      [1, 'Row 10', '', 'B1'],
    ]);
  });

  it('names the file after the park, mode and date', () => {
    const date = new Date('2026-10-02T12:00:00Z');
    expect(exportFileName({ ...park, name: 'A/B' }, 'metlen', date)).toBe('A_B_Metlen_2026-10-02.xlsx');
  });
});
