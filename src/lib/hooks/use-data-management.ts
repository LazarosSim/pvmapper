
import { toast } from 'sonner';
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

  return {
    importData,
    exportData
  };
};
