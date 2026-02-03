/**
 * Stats Sync Helpers
 * Handles updating daily_scans and user_total_scans after offline sync
 */

import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface SyncedBarcodeStats {
  userId: string;
  date: string;
  count: number;
}

/**
 * Group synced barcodes by userId and date for batch stats updates
 */
export function groupByUserAndDate(
  barcodes: Array<{ userId: string; timestamp: string }>
): SyncedBarcodeStats[] {
  const groups: Record<string, SyncedBarcodeStats> = {};

  for (const barcode of barcodes) {
    const date = barcode.timestamp.split('T')[0]; // Extract date from ISO string
    const key = `${barcode.userId}:${date}`;

    if (!groups[key]) {
      groups[key] = { userId: barcode.userId, date, count: 0 };
    }
    groups[key].count++;
  }

  return Object.values(groups);
}

/**
 * Increment daily_scans for a specific user and date
 * Uses upsert to handle both new and existing entries
 */
export async function incrementDailyScans(
  userId: string,
  date: string,
  count: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // First try to get existing entry
    const { data: existing, error: selectError } = await supabase
      .from('daily_scans')
      .select('id, count')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();

    if (selectError && selectError.code !== 'PGRST116') {
      return { success: false, error: selectError.message };
    }

    if (existing) {
      // Update existing entry
      const { error: updateError } = await supabase
        .from('daily_scans')
        .update({ count: existing.count + count })
        .eq('id', existing.id);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    } else {
      // Insert new entry
      const { error: insertError } = await supabase
        .from('daily_scans')
        .insert({
          user_id: userId,
          date,
          count,
        });

      if (insertError) {
        return { success: false, error: insertError.message };
      }
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error updating daily scans',
    };
  }
}

/**
 * Decrement daily_scans for a specific user and date
 */
export async function decrementDailyScans(
  userId: string,
  date: string,
  count: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: existing, error: selectError } = await supabase
      .from('daily_scans')
      .select('id, count')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();

    if (selectError && selectError.code !== 'PGRST116') {
      return { success: false, error: selectError.message };
    }

    if (existing) {
      const newCount = Math.max(0, existing.count - count);
      const { error: updateError } = await supabase
        .from('daily_scans')
        .update({ count: newCount })
        .eq('id', existing.id);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error updating daily scans',
    };
  }
}

/**
 * Trigger the Edge Function to recalculate user_total_scans
 */
export async function triggerUserTotalScansUpdate(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      'https://ynslzmpfhmoghvcacwzd.supabase.co/functions/v1/update-user-total-scans',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ userId }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('[StatsSync] Edge function error:', text);
      // Don't fail the sync for stats update errors - just log
      return { success: true };
    }

    return { success: true };
  } catch (err) {
    // Don't fail the sync for stats update errors - just log
    console.error('[StatsSync] Error calling update-user-total-scans:', err);
    return { success: true };
  }
}

/**
 * Update all stats after a batch sync
 * Groups barcodes by user and date, then updates daily_scans and triggers user_total_scans update
 */
export async function updateStatsAfterSync(
  syncedBarcodes: Array<{ userId: string; timestamp: string }>
): Promise<void> {
  if (syncedBarcodes.length === 0) return;

  const groups = groupByUserAndDate(syncedBarcodes);
  const uniqueUserIds = new Set(groups.map(g => g.userId));

  console.log('[StatsSync] Updating stats for', groups.length, 'user-date groups');

  // Update daily_scans for each group
  for (const group of groups) {
    const result = await incrementDailyScans(group.userId, group.date, group.count);
    if (!result.success) {
      console.error('[StatsSync] Failed to update daily_scans:', result.error);
    }
  }

  // Trigger user_total_scans update for each unique user
  for (const userId of uniqueUserIds) {
    await triggerUserTotalScansUpdate(userId);
  }

  console.log('[StatsSync] Stats update complete');
}
