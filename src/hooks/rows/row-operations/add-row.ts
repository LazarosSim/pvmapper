
import { supabase } from '@/lib/supabase/client.ts';
import { toast } from 'sonner';
import type { Row } from '../../../lib/types/db-types.ts';
import { getRowById } from '../row-utils.ts';

/**
 * Add a new row
 */
export const addRow = async (
  rows: Row[],
  setRows: React.Dispatch<React.SetStateAction<Row[]>>,
  parkId: string,
  expectedBarcodes?: number,
  navigate: boolean = true
): Promise<Row | null> => {
  // Get rows count for this park to create a sequential name
  const parkRows = rows.filter(row => row.parkId === parkId);
  const rowNumber = parkRows.length + 1;
  const rowName = `Row ${rowNumber}`;
  
  try {
    const { data, error } = await supabase
      .from('rows')
      .insert([{ 
        name: rowName,
        park_id: parkId,
        expected_barcodes: expectedBarcodes,
        current_barcodes: 0 // Initialize with 0 barcodes
      }])
      .select();
      
    if (error) {
      console.error('Error adding row:', error);
      toast.error(`Failed to create row: ${error.message}`);
      return null;
    }
    
    if (data && data[0]) {
      const newRow: Row = {
        id: data[0].id,
        name: data[0].name,
        parkId: data[0].park_id,
        createdAt: data[0].created_at,
        expectedBarcodes: data[0].expected_barcodes,
        currentBarcodes: data[0].current_barcodes || 0
      };
      
      setRows(prev => [newRow, ...prev]);
      toast.success('Row added successfully');
      return newRow;
    }
    
    return null;
  } catch (error: any) {
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
  // Get the original row
  const originalRow = rows.find(row => row.id === parentRowId);
  if (!originalRow) {
    toast.error('Parent row not found');
    return null;
  }
  
  // Extract the base row name (get the row number)
  const baseNameMatch = originalRow.name.match(/^Row\s+(\d+)(?:_[a-z])?$/i);
  if (!baseNameMatch) {
    toast.error('Unable to determine parent row base name');
    return null;
  }
  
  const rowNumber = baseNameMatch[1];
  const parkId = originalRow.parkId;
  
  // Find all related rows with the same base number
  const relatedRows = rows.filter(row => {
    const match = row.name.match(/^Row\s+(\d+)(?:_([a-z]))?$/i);
    return match && match[1] === rowNumber && row.parkId === parkId;
  });
  
  // Check if we need to rename the original row (if it doesn't have a suffix yet)
  const needsRenaming = originalRow.name === `Row ${rowNumber}`;
  
  // First, if the original row needs renaming, do that before adding a new one
  if (needsRenaming) {
    // Always rename to _a first
    await updateRow(rows, setRows, originalRow.id, `Row ${rowNumber}_a`);
    
    // After renaming, the new row will be _b
    const newRowName = `Row ${rowNumber}_b`;
    
    try {
      const { data, error } = await supabase
        .from('rows')
        .insert([{ 
          name: newRowName,
          park_id: parkId,
          expected_barcodes: expectedBarcodes,
          current_barcodes: 0 // Initialize with 0 barcodes
        }])
        .select();
        
      if (error) {
        console.error('Error adding subrow:', error);
        toast.error(`Failed to create subrow: ${error.message}`);
        return null;
      }
      
      if (data && data[0]) {
        const newRow: Row = {
          id: data[0].id,
          name: data[0].name,
          parkId: data[0].park_id,
          createdAt: data[0].created_at,
          expectedBarcodes: data[0].expected_barcodes,
          currentBarcodes: data[0].current_barcodes || 0
        };
        
        setRows(prev => [newRow, ...prev]);
        toast.success('Subrow added successfully');
        return newRow;
      }
      
      return null;
    } catch (error: any) {
      console.error('Error in addSubRow:', error.message);
      toast.error(`Failed to create subrow: ${error.message}`);
      return null;
    }
  } else {
    // The original row already has a suffix, so just determine the next letter
    const suffixes = relatedRows
      .map(row => {
        const match = row.name.match(/^Row\s+\d+_([a-z])$/i);
        return match ? match[1].toLowerCase() : '';
      })
      .filter(Boolean);
    
    // Get the last letter and increment it
    const lastLetter = String.fromCharCode(
      Math.max(...suffixes.map(s => s.charCodeAt(0)))
    );
    const nextSuffix = String.fromCharCode(lastLetter.charCodeAt(0) + 1);
    
    // Create new row with the next suffix
    const newRowName = `Row ${rowNumber}_${nextSuffix}`;
    
    try {
      const { data, error } = await supabase
        .from('rows')
        .insert([{ 
          name: newRowName,
          park_id: parkId,
          expected_barcodes: expectedBarcodes,
          current_barcodes: 0 // Initialize with 0 barcodes
        }])
        .select();
        
      if (error) {
        console.error('Error adding subrow:', error);
        toast.error(`Failed to create subrow: ${error.message}`);
        return null;
      }
      
      if (data && data[0]) {
        const newRow: Row = {
          id: data[0].id,
          name: data[0].name,
          parkId: data[0].park_id,
          createdAt: data[0].created_at,
          expectedBarcodes: data[0].expected_barcodes,
          currentBarcodes: data[0].current_barcodes || 0
        };
        
        setRows(prev => [newRow, ...prev]);
        toast.success('Subrow added successfully');
        return newRow;
      }
      
      return null;
    } catch (error: any) {
      console.error('Error in addSubRow:', error.message);
      toast.error(`Failed to create subrow: ${error.message}`);
      return null;
    }
  }
};

// Helper function for handling row updates
// Defined here to avoid circular dependencies
const updateRow = async (
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
        ? { ...row, name: name !== undefined ? name : row.name, expectedBarcodes: expectedBarcodes !== undefined ? expectedBarcodes : row.expectedBarcodes } 
        : row
    ));
    
    toast.success('Row updated successfully');
  } catch (error: any) {
    console.error('Error in updateRow:', error.message);
    toast.error(`Failed to update row: ${error.message}`);
  }
};
