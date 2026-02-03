import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Park } from '@/types/types';

// Type for the raw data from park_stats view (with nullable fields)
type RawParkStats = {
  id: string | null;
  name: string | null;
  expected_barcodes: number | null;
  current_barcodes: number | null;
  created_at: string | null;
  created_by: string | null;
  validate_barcode_length: boolean | null;
  archived: boolean | null;
  archived_at: string | null;
};

// Safe mapper that handles nullable fields from the view
const mapParkFromStats = (raw: RawParkStats): Park | null => {
  // Skip rows with null id or name (invalid data)
  if (!raw.id || !raw.name) {
    console.warn('Skipping park with null id or name:', raw);
    return null;
  }

  return {
    id: raw.id,
    name: raw.name,
    createdAt: raw.created_at ? new Date(raw.created_at) : new Date(),
    createdBy: raw.created_by || '',
    expectedBarcodes: raw.expected_barcodes ?? 0,
    currentBarcodes: raw.current_barcodes ?? 0,
    validateBarcodeLength: raw.validate_barcode_length ?? false,
    archived: raw.archived ?? false,
    archivedAt: raw.archived_at ? new Date(raw.archived_at) : null,
  };
};

/**
 * Fetches park statistics from the park_stats view
 * @param includeArchived - Whether to include archived parks
 */
const loadParkStats = async (includeArchived: boolean = false): Promise<Park[]> => {
  console.log('[loadParkStats] Fetching parks, includeArchived:', includeArchived);
  
  let query = supabase
    .from('park_stats')
    .select('id, name, expected_barcodes, current_barcodes, created_at, created_by, validate_barcode_length, archived, archived_at')
    .order('name', { ascending: true });

  if (!includeArchived) {
    query = query.or('archived.is.null,archived.eq.false');
  }

  const { data, error } = await query;
  
  if (error) {
    console.error('[loadParkStats] Error:', error);
    throw error;
  }

  console.log('[loadParkStats] Raw data received:', data?.length, 'parks');
  
  // Map and filter out any null results (invalid rows)
  const parks = (data || [])
    .map((rawPark) => mapParkFromStats(rawPark as RawParkStats))
    .filter((park): park is Park => park !== null);

  console.log('[loadParkStats] Mapped parks:', parks.map(p => ({ id: p.id, name: p.name, archived: p.archived })));
  
  return parks;
};

/**
 * Fetches a single park by ID
 */
const loadParkById = async (parkId: string): Promise<Park | null> => {
  console.log('[loadParkById] Fetching park:', parkId);
  
  const { data, error } = await supabase
    .from('park_stats')
    .select('id, name, expected_barcodes, current_barcodes, created_at, created_by, validate_barcode_length, archived, archived_at')
    .eq('id', parkId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('[loadParkById] Park not found:', parkId);
      return null;
    }
    console.error('[loadParkById] Error:', error);
    throw error;
  }

  return mapParkFromStats(data as RawParkStats);
};

/**
 * React Query hook for fetching park statistics
 * Uses offlineFirst mode to show cached data while fetching
 */
export const useParkStats = (includeArchived: boolean = false) => {
  return useQuery({
    queryKey: ['parks', { includeArchived }],
    queryFn: () => loadParkStats(includeArchived),
    networkMode: 'offlineFirst',
    staleTime: 30000, // 30 seconds
    refetchOnMount: 'always', // Always check for fresh data on mount
  });
};

/**
 * React Query hook for fetching a single park by ID
 */
export const useParkById = (parkId: string | undefined) => {
  return useQuery({
    queryKey: ['park', parkId],
    queryFn: () => loadParkById(parkId!),
    enabled: !!parkId,
    networkMode: 'offlineFirst',
    staleTime: 30000,
  });
};
