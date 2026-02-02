/**
 * Hook for managing offline barcode operations
 * Integrates IndexedDB queue with React Query
 */

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient, onlineManager } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queueBarcodeScan, getPendingBarcodesForRow } from '@/lib/offline/barcode-queue-service';
import { getQueue } from '@/lib/offline/offline-queue';
import type { OfflineBarcode, QueuedMutation } from '@/lib/offline/types';
import type { Barcode } from '@/lib/types/db-types';

interface UseOfflineBarcodesOptions {
  rowId: string;
  userId?: string;
}

/**
 * Merge server barcodes with pending offline barcodes
 */
export const mergeBarcodesWithPending = (
  serverBarcodes: Barcode[],
  pendingBarcodes: OfflineBarcode[]
): (Barcode | OfflineBarcode)[] => {
  // Create a set of pending IDs to avoid duplicates
  const pendingIds = new Set(pendingBarcodes.map(b => b.id));
  
  // Filter server barcodes that might have been synced but still in pending
  const filteredServer = serverBarcodes.filter(b => !pendingIds.has(b.id));
  
  // Combine and sort by orderInRow
  return [...filteredServer, ...pendingBarcodes].sort((a, b) => 
    (a.orderInRow ?? 0) - (b.orderInRow ?? 0)
  );
};

/**
 * Hook to add barcodes with offline-first support
 */
export const useOfflineAddBarcode = ({ rowId, userId }: UseOfflineBarcodesOptions) => {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);

  const addBarcode = useCallback(async (
    code: string,
    orderInRow: number,
    timestamp?: string,
    latitude?: number,
    longitude?: number
  ) => {
    setIsAdding(true);
    
    try {
      // Always queue locally first
      const mutation = await queueBarcodeScan(
        code,
        rowId,
        orderInRow,
        userId,
        timestamp,
        latitude,
        longitude
      );

      // Optimistically update the UI
      queryClient.setQueryData<(Barcode | OfflineBarcode)[]>(
        ['barcodes', rowId],
        (old = []) => [
          ...old,
          {
            id: mutation.id,
            code,
            rowId,
            orderInRow,
            timestamp: mutation.payload.timestamp,
            isPending: true,
            localSequence: mutation.payload.localSequence,
            latitude,
            longitude,
          } as OfflineBarcode,
        ]
      );

      return mutation;
    } finally {
      setIsAdding(false);
    }
  }, [rowId, userId, queryClient]);

  return { addBarcode, isAdding };
};

/**
 * Hook to get pending barcodes count
 */
export const usePendingCount = () => {
  const [count, setCount] = useState(0);

  const refreshCount = useCallback(async () => {
    try {
      const queue = await getQueue();
      const pendingCount = queue.filter(m => m.status === 'pending').length;
      setCount(pendingCount);
    } catch (error) {
      console.error('Error getting pending count:', error);
    }
  }, []);

  useEffect(() => {
    refreshCount();
    
    // Refresh count periodically
    const interval = setInterval(refreshCount, 2000);
    return () => clearInterval(interval);
  }, [refreshCount]);

  return { count, refreshCount };
};

/**
 * Hook to load and merge pending barcodes with server data
 */
export const useMergedBarcodes = (
  rowId: string,
  serverBarcodes: Barcode[] | undefined
) => {
  const [mergedBarcodes, setMergedBarcodes] = useState<(Barcode | OfflineBarcode)[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAndMerge = async () => {
      setIsLoading(true);
      try {
        const pending = await getPendingBarcodesForRow(rowId);
        const merged = mergeBarcodesWithPending(serverBarcodes || [], pending);
        setMergedBarcodes(merged);
      } catch (error) {
        console.error('Error merging barcodes:', error);
        setMergedBarcodes(serverBarcodes || []);
      } finally {
        setIsLoading(false);
      }
    };

    loadAndMerge();
  }, [rowId, serverBarcodes]);

  return { mergedBarcodes, isLoading };
};
