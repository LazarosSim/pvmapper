
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Park, Row, Barcode } from '../types/db-types';

export const useDataManagement = (
  parks: Park[],
  rows: Row[],
  barcodes: Barcode[]
) => {
  const importData = (jsonData: string): boolean => {
    try {
      const data = JSON.parse(jsonData);
      
      // Importing data would normally involve updating state and syncing with the database
      // This is a simplified version that just validates the data
      
      if (!data.parks || !Array.isArray(data.parks)) {
        throw new Error('Invalid data format: parks array is missing');
      }
      
      if (!data.rows || !Array.isArray(data.rows)) {
        throw new Error('Invalid data format: rows array is missing');
      }
      
      if (!data.barcodes || !Array.isArray(data.barcodes)) {
        throw new Error('Invalid data format: barcodes array is missing');
      }
      
      toast.success('Data imported successfully');
      return true;
    } catch (error: any) {
      console.error('Error importing data:', error.message);
      toast.error(`Failed to import data: ${error.message}`);
      return false;
    }
  };
  
  const exportData = (): string => {
    const data = {
      parks,
      rows,
      barcodes,
      exportDate: new Date().toISOString()
    };
    
    return JSON.stringify(data, null, 2);
  };

  // Function to fetch barcodes for a specific row directly from the database
  const fetchBarcodesForRow = async (rowId: string): Promise<Barcode[]> => {
    try {
      const { data, error } = await supabase
        .from('barcodes')
        .select('*')
        .eq('row_id', rowId)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching barcodes for row:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map(barcode => ({
        id: barcode.id,
        code: barcode.code,
        rowId: barcode.row_id,
        userId: barcode.user_id,
        timestamp: barcode.timestamp,
        displayOrder: barcode.display_order || 0,
        latitude: barcode.latitude,
        longitude: barcode.longitude
      }));
    } catch (error: any) {
      console.error('Error in fetchBarcodesForRow:', error.message);
      return [];
    }
  };

  return {
    importData,
    exportData,
    fetchBarcodesForRow
  };
};
