import {useState} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {toast} from 'sonner';
import type {Barcode, Row} from '../types/db-types';

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
          .order('order_in_row', {ascending: true});
        
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
          orderInRow: barcode.order_in_row,
          latitude: barcode.latitude,
          longitude: barcode.longitude
        }));
        
        setBarcodes(formattedBarcodes);
      }
    } catch (error: any) {
      console.error('Error in fetchBarcodes:', error.message);
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
        .select('user_id, row_id')
        .eq('id', barcodeId)
        .single();
        
      const userId = barcodeData?.user_id;
      const rowId = barcodeData?.row_id;
      
      // Now delete the barcode
      const { error } = await supabase
        .from('barcodes')
        .delete()
        .eq('id', barcodeId);

      if (error) {
        throw error;
      }

      // Update the state to remove the deleted barcode
      setBarcodes(prev => prev.filter(barcode => barcode.id !== barcodeId));

      // Update the currentBarcodes count in the row - the database trigger will handle this now
      const updatedRow = rows.find(row => row.id === rowId);
      if (updatedRow && updatedRow.currentBarcodes && updatedRow.currentBarcodes > 0) {
        updatedRow.currentBarcodes -= 1;
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
    updateBarcode,
    deleteBarcode,
    searchBarcodes,
    countBarcodesInPark
  };
};
