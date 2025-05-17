
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client.ts';
import { toast } from 'sonner';
import type { Park, Progress, Row } from '../lib/types/db-types.ts';

export const useParks = (
  rows: Row[],
  countBarcodesInPark: (parkId: string) => number
) => {
  const [parks, setParks] = useState<Park[]>([]);

  // Fetch parks data
  const fetchParks = async (userId: string | undefined) => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('parks')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error fetching parks:', error);
        toast.error(`Failed to load parks: ${error.message}`);
        return;
      }
      
      if (data) {
        const formattedParks: Park[] = data.map(park => ({
          id: park.id,
          name: park.name,
          expectedBarcodes: park.expected_barcodes || 0,
          createdAt: park.created_at,
          userId: park.user_id,
          validateBarcodeLength: park.validate_barcode_length
        }));
        
        setParks(formattedParks);
      }
    } catch (error: any) {
      console.error('Error in fetchParks:', error.message);
    }
  };

  const addPark = async (name: string, expectedBarcodes: number, validateBarcodeLength: boolean = false, userId?: string): Promise<boolean> => {
    if (!userId) return false;
    
    try {
      const { data, error } = await supabase
        .from('parks')
        .insert([{ 
          name, 
          expected_barcodes: expectedBarcodes,
          user_id: userId,
          validate_barcode_length: validateBarcodeLength
        }])
        .select();
        
      if (error) {
        console.error('Error adding park:', error);
        toast.error(`Failed to create park: ${error.message}`);
        return false;
      }
      
      if (data && data[0]) {
        const newPark: Park = {
          id: data[0].id,
          name: data[0].name,
          expectedBarcodes: data[0].expected_barcodes || 0,
          createdAt: data[0].created_at,
          userId: data[0].user_id,
          validateBarcodeLength: data[0].validate_barcode_length
        };
        
        setParks(prev => [newPark, ...prev]);
        toast.success('Park created successfully');
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('Error in addPark:', error.message);
      toast.error(`Failed to create park: ${error.message}`);
      return false;
    }
  };
  
  const updatePark = async (parkId: string, name: string, expectedBarcodes: number, validateBarcodeLength: boolean = false) => {
    try {
      const { error } = await supabase
        .from('parks')
        .update({ 
          name, 
          expected_barcodes: expectedBarcodes,
          validate_barcode_length: validateBarcodeLength
        })
        .eq('id', parkId);
        
      if (error) {
        console.error('Error updating park:', error);
        toast.error(`Failed to update park: ${error.message}`);
        return;
      }
      
      setParks(prev => prev.map(park => 
        park.id === parkId 
          ? { ...park, name, expectedBarcodes, validateBarcodeLength } 
          : park
      ));
      
      toast.success('Park updated successfully');
    } catch (error: any) {
      console.error('Error in updatePark:', error.message);
      toast.error(`Failed to update park: ${error.message}`);
    }
  };
  
  const deletePark = async (parkId: string) => {
    try {
      const { error } = await supabase
        .from('parks')
        .delete()
        .eq('id', parkId);
        
      if (error) {
        console.error('Error deleting park:', error);
        toast.error(`Failed to delete park: ${error.message}`);
        return;
      }
      
      setParks(prev => prev.filter(park => park.id !== parkId));
      toast.success('Park deleted successfully');
    } catch (error: any) {
      console.error('Error in deletePark:', error.message);
      toast.error(`Failed to delete park: ${error.message}`);
    }
  };
  
  const getParkById = (parkId: string): Park | undefined => {
    return parks.find(park => park.id === parkId);
  };
  
  const getParkProgress = (parkId: string): Progress => {
    const park = parks.find(park => park.id === parkId);
    const completed = countBarcodesInPark(parkId);
    const total = park?.expectedBarcodes || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  };

  return {
    parks,
    setParks,
    fetchParks,
    addPark,
    updatePark,
    deletePark,
    getParkById,
    getParkProgress,
  };
};
