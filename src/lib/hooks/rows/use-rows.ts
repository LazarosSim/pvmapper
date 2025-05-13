
import { useState } from 'react';
import type { Row, Barcode } from '../../types/db-types';
import { fetchRows } from './row-operations/fetch-rows';
import { addRow, addSubRow } from './row-operations/add-row';
import { updateRow, resetRow, deleteRow } from './row-operations/update-row';
import { getRowsByParkId, getRowById, countBarcodesInRow } from './row-utils';

export const useRows = () => {
  const [rows, setRows] = useState<Row[]>([]);

  return {
    rows,
    setRows,
    fetchRows: (userId?: string) => fetchRows(userId, setRows),
    getRowsByParkId: (parkId: string) => getRowsByParkId(rows, parkId),
    addRow: (parkId: string, expectedBarcodes?: number, navigate: boolean = true) => 
      addRow(rows, setRows, parkId, expectedBarcodes, navigate),
    addSubRow: (parentRowId: string, expectedBarcodes?: number) => 
      addSubRow(rows, setRows, parentRowId, expectedBarcodes),
    updateRow: (rowId: string, name: string, expectedBarcodes?: number) => 
      updateRow(rows, setRows, rowId, name, expectedBarcodes),
    deleteRow: (rowId: string) => deleteRow(rows, setRows, rowId),
    getRowById: (rowId: string) => getRowById(rows, rowId),
    resetRow: (rowId: string) => resetRow(rowId),
    countBarcodesInRow: (rowId: string) => {
      // Use the currentBarcodes property from the row
      const row = getRowById(rows, rowId);
      return row ? row.currentBarcodes : 0;
    }
  };
};
