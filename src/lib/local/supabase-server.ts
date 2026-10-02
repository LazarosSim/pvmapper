import { supabase } from '@/integrations/supabase/client';
import { fetchAllPages } from '@/lib/supabase-paging';
import type { BarcodeData } from './db';
import { toServerError, type ServerApi, type ServerPark, type ServerRow } from './server';

// Row ids per request: keeps the URL of `row_id=in.(...)` well under server limits
const ROW_ID_CHUNK = 80;
// Barcodes per insert request
const INSERT_CHUNK = 500;

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

async function run<T>(request: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  let result: { data: T; error: unknown };
  try {
    result = await request;
  } catch (error) {
    throw toServerError(error);
  }
  if (result.error) throw toServerError(result.error);
  return result.data;
}

async function paged<T>(page: Parameters<typeof fetchAllPages<T>>[0]): Promise<T[]> {
  try {
    return await fetchAllPages(page);
  } catch (error) {
    throw toServerError(error);
  }
}

const toRecord = (b: BarcodeData) => ({
  id: b.id,
  code: b.code,
  row_id: b.rowId,
  user_id: b.userId,
  order_in_row: b.orderInRow,
  timestamp: b.timestamp,
  latitude: b.latitude ?? null,
  longitude: b.longitude ?? null,
});

export const supabaseServer: ServerApi = {
  async fetchParks() {
    const data = await run(
      supabase
        .from('park_stats')
        .select('id, name, expected_barcodes, current_barcodes, created_at, created_by, validate_barcode_length, archived, archived_at')
    );
    return (data ?? [])
      .filter((p) => p.id && p.name)
      .map((p): ServerPark => ({
        id: p.id!,
        name: p.name!,
        expectedBarcodes: p.expected_barcodes ?? 0,
        currentBarcodes: p.current_barcodes ?? 0,
        validateBarcodeLength: p.validate_barcode_length ?? false,
        archived: p.archived ?? false,
        archivedAt: p.archived_at,
        createdAt: p.created_at ?? new Date(0).toISOString(),
        createdBy: p.created_by ?? '',
      }));
  },

  async fetchRows(parkIds) {
    if (parkIds.length === 0) return [];
    const rows = await paged<{
      id: string; park_id: string; name: string; expected_barcodes: number | null;
      current_barcodes: number | null; version: number; created_at: string;
    }>((from, to) =>
      supabase
        .from('rows')
        .select('id, park_id, name, expected_barcodes, current_barcodes, version, created_at')
        .in('park_id', parkIds)
        .order('id')
        .range(from, to) as never
    );
    return rows.map((r): ServerRow => ({
      id: r.id,
      parkId: r.park_id,
      name: r.name,
      expectedBarcodes: r.expected_barcodes,
      currentBarcodes: r.current_barcodes ?? 0,
      version: r.version,
      createdAt: r.created_at,
    }));
  },

  async fetchBarcodes(rowIds) {
    const all: BarcodeData[] = [];
    for (const ids of chunk(rowIds, ROW_ID_CHUNK)) {
      const records = await paged<{
        id: string; code: string; row_id: string; user_id: string; order_in_row: number | null;
        timestamp: string; latitude: number | null; longitude: number | null;
      }>((from, to) =>
        supabase
          .from('barcodes')
          .select('id, code, row_id, user_id, order_in_row, timestamp, latitude, longitude')
          .in('row_id', ids)
          .order('id')
          .range(from, to)
      );
      for (const r of records) {
        all.push({
          id: r.id,
          code: r.code,
          rowId: r.row_id,
          userId: r.user_id,
          orderInRow: r.order_in_row ?? Number.MAX_SAFE_INTEGER,
          timestamp: r.timestamp,
          latitude: r.latitude,
          longitude: r.longitude,
        });
      }
    }
    return all;
  },

  async insertBarcodes(barcodes) {
    for (const batch of chunk(barcodes, INSERT_CHUNK)) {
      await run(
        supabase.from('barcodes').upsert(batch.map(toRecord), { onConflict: 'id', ignoreDuplicates: true })
      );
    }
  },

  async insertBarcodeAt(b) {
    await run(
      supabase.rpc('insert_barcode_at' as never, {
        p_id: b.id,
        p_row_id: b.rowId,
        p_position: b.orderInRow,
        p_code: b.code,
        p_user_id: b.userId,
        p_timestamp: b.timestamp,
        p_latitude: b.latitude ?? null,
        p_longitude: b.longitude ?? null,
      } as never)
    );
  },

  async updateBarcode(id, code) {
    await run(supabase.from('barcodes').update({ code }).eq('id', id));
  },

  async deleteBarcodes(ids) {
    for (const batch of chunk(ids, ROW_ID_CHUNK)) {
      await run(supabase.from('barcodes').delete().in('id', batch));
    }
  },

  async resetRow(rowId) {
    await run(supabase.rpc('reset_row_barcodes', { p_row_id: rowId }));
  },
};
