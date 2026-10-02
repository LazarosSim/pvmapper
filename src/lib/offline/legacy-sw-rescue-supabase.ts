import { supabase } from '@/integrations/supabase/client';
import type { RescuedBarcode, RescueWriter } from './legacy-sw-rescue';

const toInsert = (barcode: RescuedBarcode) => ({
  id: barcode.id,
  code: barcode.code,
  row_id: barcode.row_id,
  user_id: barcode.user_id,
  order_in_row: barcode.order_in_row ?? null,
  timestamp: barcode.timestamp,
  latitude: barcode.latitude ?? null,
  longitude: barcode.longitude ?? null,
});

export const supabaseRescueWriter: RescueWriter = {
  async upsertWithIds(barcodes) {
    const { error } = await supabase
      .from('barcodes')
      .upsert(barcodes.map(toInsert), { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
  },

  async insertIfMissing(barcode) {
    const { data: existing, error: selectError } = await supabase
      .from('barcodes')
      .select('id')
      .eq('row_id', barcode.row_id)
      .eq('code', barcode.code)
      .limit(1);
    if (selectError) throw selectError;
    if (existing && existing.length > 0) return;

    const { id: _ignored, ...withoutId } = toInsert(barcode);
    const { error } = await supabase.from('barcodes').insert(withoutId);
    if (error) throw error;
  },
};
