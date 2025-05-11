import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Barcode, Row } from '../../../types/db-types';

/**
 * Update a row's properties
 */
export const updateRow = async (
  rows: Row[], 
  setRows: React.Dispatch<React.SetStateAction<Row[]>>, 
  rowId: string, 
  name: string,
  expectedBarcodes?: number
): Promise<void> => {
  try {
    // Data to update
    const updateData: Record<string, any> = { name };
    
    // Only include expected_barcodes in the update if it was provided
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
    
    // Update local state
    setRows(prev => prev.map(row => 
      row.id === rowId 
        ? { ...row, name, ...(expectedBarcodes !== undefined ? { expectedBarcodes } : {}) } 
        : row
    ));
    
    toast.success('Row updated successfully');
  } catch (error: any) {
    console.error('Error in updateRow:', error);
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
): Promise<boolean | void> => {
  try {
    // Get user IDs of affected barcodes for later update
    const affectedUserIds = [...new Set(
      barcodes
        .filter(barcode => barcode.rowId === rowId)
        .map(barcode => barcode.userId)
    )];
    
    // Delete barcodes from Supabase
    const { error } = await supabase
      .from('barcodes')
      .delete()
      .eq('row_id', rowId);
      
    if (error) {
      console.error('Error resetting row:', error);
      toast.error(`Failed to reset row: ${error.message}`);
      return false;
    }
    
    // Update local state by removing the deleted barcodes
    setBarcodes(prev => prev.filter(barcode => barcode.rowId !== rowId));
    
    // Update each affected user's total scan count
    for (const userId of affectedUserIds) {
      if (!userId) continue;
      
      try {
        const sessionResponse = await supabase.auth.getSession();
        const accessToken = sessionResponse.data.session?.access_token;
        
        if (!accessToken) {
          console.error('No valid session found when updating user scan count');
          continue;
        }
        
        await fetch(
          'https://ynslzmpfhmoghvcacwzd.supabase.co/functions/v1/update-user-total-scans',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ userId })
          }
        );
      } catch (error) {
        console.error(`Error updating scan count for user ${userId}:`, error);
      }
    }
    
    toast.success('Row reset successfully');
    return true;
  } catch (error: any) {
    console.error('Error in resetRow:', error);
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
): Promise<void> => {
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
