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
    // First check if we have any barcodes for this row directly from the database
    // This ensures we get the most up-to-date information rather than relying on local state
    const { data: rowBarcodesData, error: fetchError } = await supabase
      .from('barcodes')
      .select('*')
      .eq('row_id', rowId);
      
    if (fetchError) {
      console.error('Error fetching row barcodes:', fetchError);
      toast.error(`Failed to check row barcodes: ${fetchError.message}`);
      return;
    }
    
    // Now use the data directly from the database to check if there are barcodes
    if (!rowBarcodesData || rowBarcodesData.length === 0) {
      toast.info('No barcodes to reset');
      return;
    }
    
    // Format the barcodes from the database to match our local state format
    const rowBarcodes = rowBarcodesData.map(barcode => ({
      id: barcode.id,
      code: barcode.code,
      rowId: barcode.row_id,
      userId: barcode.user_id,
      timestamp: barcode.timestamp,
      orderInRow: barcode.order_in_row
    }));
    
    // Group barcodes by user and date for adjustment
    const userBarcodeCounts: {[key: string]: number} = {};
    
    // Track all affected users to update their total counts later
    const affectedUsers = new Set<string>();
    
    // Format: userId_date -> count
    rowBarcodes.forEach(barcode => {
      const scanDate = new Date(barcode.timestamp).toISOString().split('T')[0];
      const key = `${barcode.userId}_${scanDate}`;
      
      if (!userBarcodeCounts[key]) {
        userBarcodeCounts[key] = 0;
      }
      userBarcodeCounts[key]++;
      
      // Add to affected users set
      if (barcode.userId) {
        affectedUsers.add(barcode.userId);
      }
    });
    
    // Delete all barcodes for this row
    const { error } = await supabase
      .from('barcodes')
      .delete()
      .eq('row_id', rowId);
      
    if (error) {
      console.error('Error resetting row:', error);
      toast.error(`Failed to reset row: ${error.message}`);
      return;
    }
    
    // Remove barcodes from state
    setBarcodes(prev => prev.filter(barcode => barcode.rowId !== rowId));
    
    // Adjust daily scans for each affected user and date
    for (const [key, count] of Object.entries(userBarcodeCounts)) {
      const [userId, date] = key.split('_');
      
      // Get current daily scan count
      const { data: scanData } = await supabase
        .from('daily_scans')
        .select('id, count')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();
        
      if (scanData) {
        // Subtract the count and allow negative values
        const newCount = Math.max(scanData.count - count, -999999);  // Set a reasonable lower bound
        
        await supabase
          .from('daily_scans')
          .update({ count: newCount })
          .eq('id', scanData.id);
      }
    }
    
    // Update total scans count for each affected user
    for (const userId of affectedUsers) {
      try {
        const response = await fetch(
          'https://ynslzmpfhmoghvcacwzd.supabase.co/functions/v1/update-user-total-scans',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({ userId })
          }
        );
        
        if (!response.ok) {
          console.error('Failed to update user total scans:', await response.text());
        }
      } catch (error) {
        console.error('Error calling update-user-total-scans function:', error);
      }
    }
    
    toast.success(`Reset ${rowBarcodes.length} barcodes successfully`);
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
