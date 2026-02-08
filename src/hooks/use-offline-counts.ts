/**
 * Hook for offline-aware barcode count adjustments.
 * Reads the IndexedDB queue periodically and computes per-row adjustments
 * (+1 for ADD, -1 for DELETE, 0 for UPDATE).
 */

import { useState, useCallback, useEffect } from 'react';
import { getQueue } from '@/lib/offline/offline-queue';
import type { QueuedMutation } from '@/lib/offline/types';

interface OfflineAdjustments {
  /** Per-row count adjustment from pending offline mutations */
  getRowAdjustment: (rowId: string) => number;
  /** Aggregate park adjustment by summing row adjustments for all rows in the park */
  getParkAdjustment: (rowIds: string[]) => number;
  /** Whether there are any pending mutations in the queue */
  hasPendingChanges: boolean;
}

export const useOfflineAdjustedCounts = (): OfflineAdjustments => {
  const [rowAdjustments, setRowAdjustments] = useState<Map<string, number>>(new Map());
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  const computeAdjustments = useCallback(async () => {
    try {
      const queue: QueuedMutation[] = await getQueue();
      const pending = queue.filter(m => m.status === 'pending');
      const adjustments = new Map<string, number>();

      for (const mutation of pending) {
        const rowId = mutation.payload.rowId;
        const current = adjustments.get(rowId) ?? 0;

        if (mutation.type === 'ADD_BARCODE') {
          adjustments.set(rowId, current + 1);
        } else if (mutation.type === 'DELETE_BARCODE') {
          adjustments.set(rowId, current - 1);
        }
        // UPDATE_BARCODE doesn't change counts
      }

      setRowAdjustments(adjustments);
      setHasPendingChanges(pending.length > 0);
    } catch (error) {
      console.error('[OfflineCounts] Error computing adjustments:', error);
    }
  }, []);

  useEffect(() => {
    computeAdjustments();
    const interval = setInterval(computeAdjustments, 2000);
    return () => clearInterval(interval);
  }, [computeAdjustments]);

  const getRowAdjustment = useCallback(
    (rowId: string) => rowAdjustments.get(rowId) ?? 0,
    [rowAdjustments]
  );

  const getParkAdjustment = useCallback(
    (rowIds: string[]) => {
      let total = 0;
      for (const rowId of rowIds) {
        total += rowAdjustments.get(rowId) ?? 0;
      }
      return total;
    },
    [rowAdjustments]
  );

  return { getRowAdjustment, getParkAdjustment, hasPendingChanges };
};
