/**
 * Hook for searching barcodes in the database
 * Replaces the legacy in-memory search from db-provider
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Barcode } from '@/lib/types/db-types';

interface SearchResult extends Barcode {
  rowName?: string;
  parkId?: string;
  parkName?: string;
}

const searchBarcodesInDb = async (query: string): Promise<SearchResult[]> => {
  if (!query || query.length < 3) {
    return [];
  }

  const { data, error } = await supabase
    .from('barcodes')
    .select(`
      id,
      code,
      row_id,
      user_id,
      timestamp,
      order_in_row,
      latitude,
      longitude,
      rows (
        id,
        name,
        park_id,
        parks (
          id,
          name
        )
      )
    `)
    .ilike('code', `%${query}%`)
    .order('timestamp', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error searching barcodes:', error);
    throw error;
  }

  return (data || []).map((barcode: any) => ({
    id: barcode.id,
    code: barcode.code,
    rowId: barcode.row_id,
    userId: barcode.user_id,
    timestamp: barcode.timestamp,
    orderInRow: barcode.order_in_row,
    latitude: barcode.latitude,
    longitude: barcode.longitude,
    rowName: barcode.rows?.name,
    parkId: barcode.rows?.park_id,
    parkName: barcode.rows?.parks?.name,
  }));
};

export const useSearchBarcodes = (query: string) => {
  return useQuery({
    queryKey: ['barcodes', 'search', query],
    queryFn: () => searchBarcodesInDb(query),
    enabled: query.length >= 3,
    staleTime: 30000, // Cache for 30 seconds
    retry: false,
  });
};
