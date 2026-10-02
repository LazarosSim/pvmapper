/**
 * What screens read. Active parks come from the phone's copy and update live; archived
 * parks are not kept on the phone and are read from the server when online.
 */
import { useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPages } from '@/lib/supabase-paging';
import { naturalCompare } from '@/lib/utils';
import { db, type LocalBarcode, type LocalPark, type LocalRow, type OutboxEntry } from './db';
import { sortBarcodes } from './apply-ops';
import { getSyncStatus, subscribeSyncStatus } from './sync';
import { useNetworkStatus } from '@/hooks/use-network-status';

export interface ParkSummary extends LocalPark {
  /** Barcodes in the park, including unsent scans on this phone */
  barcodeCount: number;
  /** null for archived parks (their rows are not kept on the phone) */
  rowCount: number | null;
  pendingCount: number;
}

export interface RowSummary extends LocalRow {
  barcodeCount: number;
  pendingCount: number;
  parkName: string;
}

export type RowBarcode = Pick<
  LocalBarcode,
  'id' | 'rowId' | 'code' | 'orderInRow' | 'timestamp' | 'userId' | 'latitude' | 'longitude' | 'pending'
>;

/** All parks, sorted by name; undefined until the phone's copy has been read. */
export function useParks(): ParkSummary[] | undefined {
  return useLiveQuery(async () => {
    const parks = await db.parks.toArray();
    const summaries = await Promise.all(
      parks.map(async (park): Promise<ParkSummary> => {
        if (park.archived) {
          return { ...park, barcodeCount: park.currentBarcodes, rowCount: null, pendingCount: 0 };
        }
        const [barcodeCount, rowCount, pendingCount] = await Promise.all([
          db.barcodes.where('parkId').equals(park.id).count(),
          db.rows.where('parkId').equals(park.id).count(),
          db.barcodes.where('parkId').equals(park.id).filter((b) => b.pending === 1).count(),
        ]);
        return { ...park, barcodeCount, rowCount, pendingCount };
      })
    );
    return summaries.sort((a, b) => a.name.localeCompare(b.name));
  }, []);
}

export function usePark(parkId: string | undefined): LocalPark | null | undefined {
  return useLiveQuery(async () => (parkId ? (await db.parks.get(parkId)) ?? null : null), [parkId]);
}

const loadServerRows = async (parkId: string, parkName: string): Promise<RowSummary[]> => {
  const rows = await fetchAllPages<{
    id: string; park_id: string; name: string; expected_barcodes: number | null;
    current_barcodes: number | null; created_at: string;
  }>((from, to) =>
    supabase
      .from('rows')
      .select('id, park_id, name, expected_barcodes, current_barcodes, created_at')
      .eq('park_id', parkId)
      .order('id')
      .range(from, to)
  );
  return rows.map((r) => ({
    id: r.id,
    parkId: r.park_id,
    name: r.name,
    expectedBarcodes: r.expected_barcodes,
    currentBarcodes: r.current_barcodes ?? 0,
    version: -1,
    createdAt: r.created_at,
    barcodeCount: r.current_barcodes ?? 0,
    pendingCount: 0,
    parkName,
  }));
};

/** Rows of a park in natural order, with counts. */
export function useParkRows(parkId: string | undefined): { rows: RowSummary[] | undefined; isLoading: boolean } {
  const park = usePark(parkId);
  const isLocal = !!park && !park.archived;

  const local = useLiveQuery(async () => {
    if (!parkId || !isLocal) return undefined;
    const [rows, barcodes] = await Promise.all([
      db.rows.where('parkId').equals(parkId).toArray(),
      db.barcodes.where('parkId').equals(parkId).toArray(),
    ]);
    const counts = new Map<string, { total: number; pending: number }>();
    for (const b of barcodes) {
      const count = counts.get(b.rowId) ?? { total: 0, pending: 0 };
      count.total++;
      count.pending += b.pending;
      counts.set(b.rowId, count);
    }
    return rows
      .map((row) => ({
        ...row,
        barcodeCount: counts.get(row.id)?.total ?? 0,
        pendingCount: counts.get(row.id)?.pending ?? 0,
        parkName: park!.name,
      }))
      .sort((a, b) => naturalCompare(a.name, b.name));
  }, [parkId, isLocal, park?.name]);

  const remote = useQuery({
    queryKey: ['server', 'rows', parkId],
    queryFn: () => loadServerRows(parkId!, park!.name),
    enabled: !!park && park.archived,
    select: (rows) => [...rows].sort((a, b) => naturalCompare(a.name, b.name)),
  });

  if (park === undefined) return { rows: undefined, isLoading: true };
  if (park === null) return { rows: [], isLoading: false };
  return isLocal
    ? { rows: local, isLoading: local === undefined }
    : { rows: remote.data, isLoading: remote.isLoading };
}

/** One row with its park name; null when it is not on the phone and not on the server. */
export function useRow(rowId: string | undefined): { row: RowSummary | null | undefined; isLocal: boolean } {
  const local = useLiveQuery(async () => {
    if (!rowId) return null;
    const row = await db.rows.get(rowId);
    if (!row) return null;
    const park = await db.parks.get(row.parkId);
    const barcodes = await db.barcodes.where('rowId').equals(rowId).toArray();
    return {
      ...row,
      parkName: park?.name ?? '',
      barcodeCount: barcodes.length,
      pendingCount: barcodes.filter((b) => b.pending).length,
    };
  }, [rowId]);

  const remote = useQuery({
    queryKey: ['server', 'row', rowId],
    enabled: !!rowId && local === null,
    queryFn: async (): Promise<RowSummary | null> => {
      const { data, error } = await supabase
        .from('rows')
        .select('id, park_id, name, expected_barcodes, current_barcodes, created_at, park:parks(name)')
        .eq('id', rowId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        parkId: data.park_id,
        name: data.name,
        expectedBarcodes: data.expected_barcodes,
        currentBarcodes: data.current_barcodes ?? 0,
        version: -1,
        createdAt: data.created_at,
        barcodeCount: data.current_barcodes ?? 0,
        pendingCount: 0,
        parkName: (data.park as { name: string } | null)?.name ?? '',
      };
    },
  });

  if (local === undefined) return { row: undefined, isLocal: false };
  if (local) return { row: local, isLocal: true };
  if (remote.isLoading) return { row: undefined, isLocal: false };
  return { row: remote.data ?? null, isLocal: false };
}

/** A row's barcodes in order. */
export function useRowBarcodes(rowId: string | undefined, isLocal: boolean): RowBarcode[] | undefined {
  const local = useLiveQuery(
    async () => (rowId && isLocal ? sortBarcodes(await db.barcodes.where('rowId').equals(rowId).toArray()) : undefined),
    [rowId, isLocal]
  );

  const remote = useQuery({
    queryKey: ['server', 'barcodes', rowId],
    enabled: !!rowId && !isLocal,
    queryFn: async (): Promise<RowBarcode[]> => {
      const data = await fetchAllPages<{
        id: string; code: string; row_id: string; user_id: string; order_in_row: number | null;
        timestamp: string; latitude: number | null; longitude: number | null;
      }>((from, to) =>
        supabase
          .from('barcodes')
          .select('id, code, row_id, user_id, order_in_row, timestamp, latitude, longitude')
          .eq('row_id', rowId!)
          .order('id')
          .range(from, to)
      );
      return sortBarcodes(
        data.map((b) => ({
          id: b.id,
          rowId: b.row_id,
          code: b.code,
          orderInRow: b.order_in_row ?? Number.MAX_SAFE_INTEGER,
          timestamp: b.timestamp,
          userId: b.user_id,
          latitude: b.latitude,
          longitude: b.longitude,
          pending: 0 as const,
        }))
      );
    },
  });

  return isLocal ? local : remote.data;
}

export interface SyncSummary {
  online: boolean;
  syncing: boolean;
  /** Changes on this phone not uploaded yet */
  pendingCount: number;
  /** Changes the server refused; shown so the user can retry or discard them */
  failed: OutboxEntry[];
  lastSyncedAt: string | null;
  lastError: string | null;
  /** True once this phone has a copy of the parks (first download done) */
  hasLocalData: boolean;
}

export function useSyncSummary(): SyncSummary {
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
  const { isOnline } = useNetworkStatus();
  const counts = useLiveQuery(async () => ({
    pendingCount: await db.outbox.where('status').anyOf('pending', 'sending').count(),
    failed: await db.outbox.where('status').equals('failed').toArray(),
    hasLocalData: (await db.parks.count()) > 0,
  }), []);
  return {
    online: isOnline,
    syncing: status.syncing,
    lastSyncedAt: status.lastSyncedAt,
    lastError: status.lastError,
    pendingCount: counts?.pendingCount ?? 0,
    failed: counts?.failed ?? [],
    hasLocalData: counts?.hasLocalData ?? true,
  };
}
