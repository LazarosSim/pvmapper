/**
 * Barcode search. Active parks are searched on the phone's own copy, so it works offline
 * and includes unsent scans; archived parks are searched on the server when online.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { codeKey, db } from '@/lib/local/db';
import { useNetworkStatus } from '@/hooks/use-network-status';

export interface SearchResult {
  id: string;
  code: string;
  rowId: string;
  timestamp: string;
  rowName?: string;
  parkName?: string;
  pending?: boolean;
}

const LIMIT = 50;

const searchLocal = async (key: string): Promise<SearchResult[]> => {
  const matches = await db.barcodes.filter((b) => b.codeKey.includes(key)).limit(LIMIT).toArray();
  const rows = await db.rows.bulkGet([...new Set(matches.map((b) => b.rowId))]);
  const rowById = new Map(rows.filter(Boolean).map((r) => [r!.id, r!]));
  const parks = await db.parks.bulkGet([...new Set(matches.map((b) => b.parkId))]);
  const parkById = new Map(parks.filter(Boolean).map((p) => [p!.id, p!]));
  return matches.map((b) => ({
    id: b.id,
    code: b.code,
    rowId: b.rowId,
    timestamp: b.timestamp,
    rowName: rowById.get(b.rowId)?.name,
    parkName: parkById.get(b.parkId)?.name,
    pending: b.pending === 1,
  }));
};

type ServerMatch = {
  id: string;
  code: string;
  row_id: string;
  timestamp: string;
  rows: { name: string; parks: { name: string } | null } | null;
};

const searchServer = async (query: string): Promise<SearchResult[]> => {
  const { data, error } = await supabase
    .from('barcodes')
    .select('id, code, row_id, timestamp, rows (name, parks (name))')
    .ilike('code', `%${query}%`)
    .order('timestamp', { ascending: false })
    .limit(LIMIT);
  if (error) throw error;
  return ((data ?? []) as unknown as ServerMatch[]).map((b) => ({
    id: b.id,
    code: b.code,
    rowId: b.row_id,
    timestamp: b.timestamp,
    rowName: b.rows?.name,
    parkName: b.rows?.parks?.name,
  }));
};

export const useSearchBarcodes = (query: string) => {
  const trimmed = query.trim();
  const key = codeKey(trimmed);
  const enabled = key.length >= 3;
  const { isOnline } = useNetworkStatus();

  const local = useLiveQuery(() => (enabled ? searchLocal(key) : []), [key, enabled]);
  const localRowIds = useLiveQuery(async () => new Set(await db.rows.toCollection().primaryKeys()), []);

  const server = useQuery({
    queryKey: ['server', 'barcode-search', trimmed],
    queryFn: () => searchServer(trimmed),
    enabled: enabled && isOnline,
    staleTime: 30000,
    retry: false,
  });

  // The phone's copy is the truth for the rows it holds (it includes unsent changes);
  // the server adds the rows the phone doesn't keep (archived parks).
  const fromServer = (server.data ?? []).filter((b) => !localRowIds?.has(b.rowId));
  const results = [...(local ?? []), ...fromServer]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, LIMIT);

  return {
    data: enabled ? results : [],
    isLoading: enabled && local === undefined,
    isSearchingServer: enabled && isOnline && server.isFetching,
    onlyThisPhone: enabled && (!isOnline || server.isError),
  };
};
