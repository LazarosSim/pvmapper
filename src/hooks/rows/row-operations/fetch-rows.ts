
import { supabase } from '@/lib/supabase/client.ts';
import { toast } from 'sonner';
import type { Row } from '../../../lib/types/db-types.ts';

/**
 * Fetch rows data from Supabase
 */
export const fetchRows = async (
  userId?: string, 
  setRows?: React.Dispatch<React.SetStateAction<Row[]>>
): Promise<Row[] | undefined> => {
  if (!userId) return;
  
  try {
    const { data, error } = await supabase
      .from('rows')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching rows:', error);
      toast.error(`Failed to load rows: ${error.message}`);
      return;
    }
    
    if (data) {
      const formattedRows: Row[] = data.map(row => ({
        id: row.id,
        name: row.name,
        parkId: row.park_id,
        createdAt: row.created_at,
        expectedBarcodes: row.expected_barcodes,
        currentBarcodes: row.current_barcodes || 0
      }));
      
      if (setRows) {
        setRows(formattedRows);
      }
      
      return formattedRows;
    }
  } catch (error: any) {
    console.error('Error in fetchRows:', error.message);
  }
};
