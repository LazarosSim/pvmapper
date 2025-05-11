
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Row, Barcode } from '../types/db-types';
import { fetchRows } from './rows/row-operations/fetch-rows';
import { addRow, addSubRow } from './rows/row-operations/add-row';
import { updateRow, resetRow, deleteRow } from './rows/row-operations/update-row';
import { getRowsByParkId, getRowById, countBarcodesInRow } from './rows/row-utils';

export const useRows = (barcodes: Barcode[], setBarcodes: React.Dispatch<React.SetStateAction<Barcode[]>>) => {
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
    deleteRow: (rowId: string) => deleteRow(rows, setRows, barcodes, setBarcodes, rowId),
    getRowById: (rowId: string) => getRowById(rows, rowId),
    resetRow: (rowId: string) => resetRow(barcodes, setBarcodes, rowId),
    countBarcodesInRow: (rowId: string) => {
      // Use the currentBarcodes property from the row
      const row = getRowById(rows, rowId);
      return row ? row.currentBarcodes : 0;
    }
  };
};
