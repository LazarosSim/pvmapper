import {supabase} from '@/integrations/supabase/client';
import {toast} from 'sonner';
import type {Barcode, Row} from '../../../types/db-types';

/**
 * Update a row's properties
 */
export const updateRow = async (
  rows: Row[],
  setRows: React.Dispatch<React.SetStateAction<Row[]>>,
  rowId: string, 
  name: string, 
  expectedBarcodes?: number
) => {
  try {
    const updateData: { name?: string; expected_barcodes?: number | null } = {};
    
    if (name !== undefined) {
      updateData.name = name;
    }
    
    if (expectedBarcodes !== undefined) {
      updateData.expected_barcodes = expectedBarcodes;
    }
    
    const { error } = await supabase
      .from('rows')
      .update(updateData)
      .eq('id', rowId);
      
    if (error) {
      console.error('Error updating row:', error);
      toast.error(`Failed to update row: ${error.message}`);
      return;
    }
    
    setRows(prev => prev.map(row => 
      row.id === rowId 
        ? { ...row, 
            name: name !== undefined ? name : row.name, 
            expectedBarcodes: expectedBarcodes !== undefined ? expectedBarcodes : row.expectedBarcodes 
          } 
        : row
    ));
    
    toast.success('Row updated successfully');
  } catch (error: any) {
    console.error('Error in updateRow:', error.message);
    toast.error(`Failed to update row: ${error.message}`);
  }
};

/**
 * Reset all barcodes for a row
 */
export const resetRow = async (
  barcodes: Barcode[],
  setBarcodes: React.Dispatch<React.SetStateAction<Barcode[]>>,
  rowId: string
) => {
  try {
    // Use server-side function to delete all barcodes efficiently
    const { data, error } = await supabase.rpc('reset_row_barcodes', { p_row_id: rowId });

    if (error) {
      console.error('Error resetting row:', error);
      toast.error(`Failed to reset row: ${error.message}`);
      return false;
    }

    const deletedCount = data as number;

    // Remove barcodes from local state
    setBarcodes(prev => prev.filter(barcode => barcode.rowId !== rowId));

    if (deletedCount === 0) {
      toast.info('No barcodes to reset');
    } else {
      toast.success(`Reset ${deletedCount} barcodes successfully`);
    }
    return true;
  } catch (error: any) {
    console.error('Error in resetRow:', error.message);
    toast.error(`Failed to reset row: ${error.message}`);
    return false;
  }
};

/**
 * Delete a row and all its barcodes
 */
export const deleteRow = async (
  rows: Row[],
  setRows: React.Dispatch<React.SetStateAction<Row[]>>,
  barcodes: Barcode[],
  setBarcodes: React.Dispatch<React.SetStateAction<Barcode[]>>,
  rowId: string
) => {
  try {
    // Check if the row has expected barcodes set and the current user is not a manager
    const rowToDelete = rows.find(row => row.id === rowId);
    
    if (rowToDelete?.expectedBarcodes !== null && rowToDelete?.expectedBarcodes !== undefined) {
      // This check will be done in the components that call this function
      // because we need access to isManager() from the DB context
      // This will be handled in row-card.tsx
    }
    
    // First reset the row (which will handle adjusting barcode counts)
    await resetRow(barcodes, setBarcodes, rowId);
    
    // Then delete the row
    const { error } = await supabase
      .from('rows')
      .delete()
      .eq('id', rowId);
      
    if (error) {
      console.error('Error deleting row:', error);
      toast.error(`Failed to delete row: ${error.message}`);
      return;
    }
    
    // Remove row from state
    setRows(prev => prev.filter(row => row.id !== rowId));
    
    toast.success('Row deleted successfully');
  } catch (error: any) {
    console.error('Error in deleteRow:', error.message);
    toast.error(`Failed to delete row: ${error.message}`);
  }
};
