import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Row } from '../../../types/db-types';
import { fetchAllPages } from '@/lib/supabase-paging';
import { nextRowName, planSubRow } from '@/lib/row-naming';

// Names are worked out from the park's rows on the server: the provider's local
// `rows` list is no longer loaded, so it can't be used to number new rows.
const fetchParkRowNames = (parkId: string) =>
  fetchAllPages<{ name: string }>((from, to) =>
    supabase.from('rows').select('name').eq('park_id', parkId).order('id').range(from, to)
  ).then((rows) => rows.map((row) => row.name));

const insertRow = async (
  setRows: React.Dispatch<React.SetStateAction<Row[]>>,
  parkId: string,
  name: string,
  expectedBarcodes: number | undefined,
  label: 'row' | 'subrow'
): Promise<Row | null> => {
  const { data, error } = await supabase
    .from('rows')
    .insert([{
      name,
      park_id: parkId,
      expected_barcodes: expectedBarcodes,
      current_barcodes: 0 // Initialize with 0 barcodes
    }])
    .select();

  if (error) {
    console.error(`Error adding ${label}:`, error);
    toast.error(`Failed to create ${label}: ${error.message}`);
    return null;
  }

  if (!data || !data[0]) return null;

  const newRow: Row = {
    id: data[0].id,
    name: data[0].name,
    parkId: data[0].park_id,
    createdAt: data[0].created_at,
    expectedBarcodes: data[0].expected_barcodes,
    currentBarcodes: data[0].current_barcodes || 0
  };

  setRows(prev => [newRow, ...prev]);
  toast.success(label === 'row' ? 'Row added successfully' : 'Subrow added successfully');
  return newRow;
};

/**
 * Add a new row
 */
export const addRow = async (
  rows: Row[],
  setRows: React.Dispatch<React.SetStateAction<Row[]>>,
  parkId: string,
  expectedBarcodes?: number,
  navigate: boolean = true,
  customName?: string  // New parameter for custom row naming
): Promise<Row | null> => {
  try {
    // Use custom name if provided, otherwise the next free "Row N" in this park
    const rowName = customName || nextRowName(await fetchParkRowNames(parkId));
    return await insertRow(setRows, parkId, rowName, expectedBarcodes, 'row');
  } catch (caught) {
    const error = caught as Error;
    console.error('Error in addRow:', error.message);
    toast.error(`Failed to create row: ${error.message}`);
    return null;
  }
};

/**
 * Add a subrow to an existing row
 */
export const addSubRow = async (
  rows: Row[],
  setRows: React.Dispatch<React.SetStateAction<Row[]>>,
  parentRowId: string,
  expectedBarcodes?: number
): Promise<Row | null> => {
  try {
    const { data: parent, error } = await supabase
      .from('rows')
      .select('id, name, park_id')
      .eq('id', parentRowId)
      .maybeSingle();

    if (error) throw error;
    if (!parent) {
      toast.error('Parent row not found');
      return null;
    }

    const plan = planSubRow(parent.name, await fetchParkRowNames(parent.park_id));
    if ('error' in plan) {
      toast.error(plan.error);
      return null;
    }

    // "Row 5" is renamed to "Row 5_a" before "Row 5_b" is added
    if (plan.renameParentTo) {
      await updateRow(setRows, parent.id, plan.renameParentTo);
    }

    return await insertRow(setRows, parent.park_id, plan.newRowName, expectedBarcodes, 'subrow');
  } catch (caught) {
    const error = caught as Error;
    console.error('Error in addSubRow:', error.message);
    toast.error(`Failed to create subrow: ${error.message}`);
    return null;
  }
};

// Helper function for handling row updates
// Defined here to avoid circular dependencies
const updateRow = async (
  setRows: React.Dispatch<React.SetStateAction<Row[]>>,
  rowId: string,
  name: string
) => {
  const { error } = await supabase
    .from('rows')
    .update({ name })
    .eq('id', rowId);

  if (error) {
    console.error('Error updating row:', error);
    throw new Error(`Failed to rename parent row: ${error.message}`);
  }

  setRows(prev => prev.map(row => row.id === rowId ? { ...row, name } : row));
};
