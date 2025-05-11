import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Barcode, Row } from '../types/db-types';

export const useBarcodes = (
  rows: Row[],
  updateDailyScans: (userId?: string) => Promise<void>,
  decreaseDailyScans: (userId?: string) => Promise<void>
) => {
  const [barcodes, setBarcodes] = useState<Barcode[]>([]);

  // Fetch barcodes data
  const fetchBarcodes = async (userId: string) => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('barcodes')
        .select('*')
        .order('display_order', { ascending: true });
        
      if (error) {
        console.error('Error fetching barcodes:', error);
        toast.error(`Failed to load barcodes: ${error.message}`);
        return;
      }
      
      if (data) {
        const formattedBarcodes: Barcode[] = data.map(barcode => ({
          id: barcode.id,
          code: barcode.code,
          rowId: barcode.row_id,
          userId: barcode.user_id,
          timestamp: barcode.timestamp,
          displayOrder: barcode.display_order || 0,
          latitude: barcode.latitude,
          longitude: barcode.longitude
        }));
        
        setBarcodes(formattedBarcodes);
      }
    } catch (error: any) {
      console.error('Error in fetchBarcodes:', error.message);
    }
  };

  // Add a barcode
  const addBarcode = async (
    code: string,
    rowId: string,
    afterBarcodeIndex?: number,
    location?: { latitude: number, longitude: number } | null,
    userId?: string
  ): Promise<Barcode | null> => {
    if (!code.trim()) {
      toast.error('Barcode cannot be empty');
      return null;
    }

    const row = rows.find(r => r.id === rowId);
    if (!row) {
      toast.error('Row not found');
      return null;
    }

    try {
      // Get barcodes for this row to determine display order
      const rowBarcodes = barcodes
        .filter(barcode => barcode.rowId === rowId)
        .sort((a, b) => a.displayOrder - b.displayOrder);
      
      // Determine the new display order
      let newDisplayOrder = 0;
      
      if (rowBarcodes.length > 0) {
        if (afterBarcodeIndex !== undefined && afterBarcodeIndex >= 0 && afterBarcodeIndex < rowBarcodes.length) {
          // Insert after the specified barcode
          const afterBarcode = rowBarcodes[afterBarcodeIndex];
          const laterBarcodes = rowBarcodes.filter(b => b.displayOrder > afterBarcode.displayOrder);
          
          if (laterBarcodes.length > 0) {
            const nextBarcode = laterBarcodes[0];
            newDisplayOrder = (afterBarcode.displayOrder + nextBarcode.displayOrder) / 2;
          } else {
            newDisplayOrder = afterBarcode.displayOrder + 1000;
          }
        } else {
          // Add to beginning with smaller display order
          newDisplayOrder = rowBarcodes[0].displayOrder - 1000;
        }
      }

      // Prepare the barcode data to insert
      const barcodeData: any = { 
        code,
        row_id: rowId,
        user_id: userId,
        display_order: newDisplayOrder
      };
      
      // Add location data if available
      if (location) {
        barcodeData.latitude = location.latitude;
        barcodeData.longitude = location.longitude;
      }
      
      const { data, error } = await supabase
        .from('barcodes')
        .insert([barcodeData])
        .select();
        
      if (error) {
        console.error('Error adding barcode:', error);
        toast.error(`Failed to add barcode: ${error.message}`);
        return null;
      }
      
      if (data && data[0]) {
        const newBarcode: Barcode = {
          id: data[0].id,
          code: data[0].code,
          rowId: data[0].row_id,
          userId: data[0].user_id,
          timestamp: data[0].timestamp,
          displayOrder: data[0].display_order || 0,
          latitude: data[0].latitude,
          longitude: data[0].longitude
        };
        
        setBarcodes(prev => [newBarcode, ...prev]);
        
        // Update the barcodes count in row
        const updatedRow = rows.find(row => row.id === rowId);
        if (updatedRow) {
          updatedRow.currentBarcodes = (updatedRow.currentBarcodes || 0) + 1;
        }
        
        // If successful, update daily scan count
        await updateDailyScans(userId);
        
        // Update the user's total scans count in profile
        if (userId) {
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
        
        return newBarcode;
      }
      
      return null;
    } catch (error: any) {
      console.error('Error in addBarcode:', error.message);
      toast.error(`Failed to add barcode: ${error.message}`);
      return null;
    }
  };
  
  const updateBarcode = async (barcodeId: string, code: string) => {
    try {
      const { error } = await supabase
        .from('barcodes')
        .update({ code })
        .eq('id', barcodeId);
        
      if (error) {
        console.error('Error updating barcode:', error);
        toast.error(`Failed to update barcode: ${error.message}`);
        return;
      }
      
      setBarcodes(prev => prev.map(barcode => 
        barcode.id === barcodeId 
          ? { ...barcode, code } 
          : barcode
      ));
      
      toast.success('Barcode updated successfully');
    } catch (error: any) {
      console.error('Error in updateBarcode:', error.message);
      toast.error(`Failed to update barcode: ${error.message}`);
    }
  };
  
  const deleteBarcode = async (barcodeId: string): Promise<void> => {
    try {
      // First, get the barcode to know which user it belongs to
      const { data: barcodeData } = await supabase
        .from('barcodes')
        .select('user_id')
        .eq('id', barcodeId)
        .single();
        
      const userId = barcodeData?.user_id;
      
      // Now delete the barcode
      const { error } = await supabase
        .from('barcodes')
        .delete()
        .eq('id', barcodeId);

      if (error) {
        throw error;
      }

      if (userId) {
        // Decrease daily scans count
        await decreaseDailyScans(userId);
        
        // Update the user's total scans count
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

      toast.success('Barcode deleted successfully');
    } catch (error: any) {
      console.error('Error deleting barcode:', error);
      toast.error(`Failed to delete barcode: ${error.message}`);
    }
  };
  
  const getBarcodesByRowId = (rowId: string): Barcode[] => {
    return barcodes
      .filter(barcode => barcode.rowId === rowId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  };
  
  const searchBarcodes = (query: string): Barcode[] => {
    if (!query.trim()) return [];
    
    return barcodes.filter(barcode => 
      barcode.code.toLowerCase().includes(query.toLowerCase())
    );
  };
  
  const countBarcodesInPark = (parkId: string): number => {
    const parkRows = rows.filter(row => row.parkId === parkId);
    const rowIds = parkRows.map(row => row.id);
    
    return barcodes.filter(barcode => rowIds.includes(barcode.rowId)).length;
  };

  return {
    barcodes,
    setBarcodes,
    fetchBarcodes,
    addBarcode,
    updateBarcode,
    deleteBarcode,
    getBarcodesByRowId,
    searchBarcodes,
    countBarcodesInPark
  };
};
