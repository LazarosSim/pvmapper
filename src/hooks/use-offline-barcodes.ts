/**
 * Hook for managing offline barcode operations
 * Integrates IndexedDB queue with React Query
 */

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  queueBarcodeScan, 
  getPendingBarcodesForRow,
  queueBarcodeDelete,
  queueBarcodeUpdate,
  getPendingDeleteIds,
  getPendingUpdates,
} from '@/lib/offline/barcode-queue-service';
import { getQueue } from '@/lib/offline/offline-queue';
import type { OfflineBarcode, QueuedMutation } from '@/lib/offline/types';
import type { Barcode } from '@/lib/types/db-types';

interface UseOfflineBarcodesOptions {
  rowId: string;
  userId?: string;
}

// Extended type for merged barcodes that can have offline indicators
export type MergedBarcode = (Barcode | OfflineBarcode) & { 
  isPending?: boolean; 
  isDeleting?: boolean; 
  pendingCode?: string;
};

/**
 * Merge server barcodes with pending offline barcodes
 * Handles ADD, DELETE, and UPDATE mutations
 */
export const mergeBarcodesWithPending = async (
  serverBarcodes: Barcode[],
  rowId: string
): Promise<MergedBarcode[]> => {
  // Get all pending mutations for this row
  const pendingAdds = await getPendingBarcodesForRow(rowId);
  const pendingDeleteIds = await getPendingDeleteIds(rowId);
  const pendingUpdates = await getPendingUpdates(rowId);

  // Create a set of pending add IDs to avoid duplicates
  const pendingAddIds = new Set(pendingAdds.map(b => b.id));

  // Process server barcodes
  const processedServer: MergedBarcode[] = serverBarcodes
    // Filter out barcodes that are also in pending adds (shouldn't happen but safety check)
    .filter(b => !pendingAddIds.has(b.id))
    // Mark deleted items and apply pending updates
    .map(b => {
      const isDeleting = pendingDeleteIds.has(b.id);
      const pendingCode = pendingUpdates.get(b.id);
      
      return {
        ...b,
        isDeleting,
        pendingCode,
        // If there's a pending update, show the new code
        code: pendingCode || b.code,
      };
    })
    // Filter out items marked for deletion from the display
    .filter(b => !b.isDeleting);

  // Combine and sort by orderInRow with defensive fallback
  const combined: MergedBarcode[] = [...processedServer, ...pendingAdds];
  
  return combined.sort((a, b) => {
    // Primary sort: by orderInRow (required for correct display)
    // Use MAX_SAFE_INTEGER for undefined to push corrupted data to end, not beginning
    const orderA = a.orderInRow ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.orderInRow ?? Number.MAX_SAFE_INTEGER;
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    
    // Fallback: sort by timestamp to maintain insertion order
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    return timeA - timeB;
  });
};

/**
 * Simplified merge that just returns (Barcode | OfflineBarcode)[] 
 * for cases where we don't need delete/update indicators
 */
export const mergeBarcodesWithPendingSimple = (
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
        ['barcodes', 'row', rowId],
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
 * Hook to delete barcodes with offline-first support
 */
export const useOfflineDeleteBarcode = ({ rowId, userId }: UseOfflineBarcodesOptions) => {
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteBarcode = useCallback(async (
    barcodeId: string,
    code: string,
    timestamp: string
  ) => {
    setIsDeleting(true);
    
    try {
      // Queue the delete operation
      const mutation = await queueBarcodeDelete(
        barcodeId,
        rowId,
        code,
        timestamp,
        userId
      );

      // Optimistically remove from UI
      queryClient.setQueryData<(Barcode | OfflineBarcode)[]>(
        ['barcodes', 'row', rowId],
        (old = []) => old.filter(b => b.id !== barcodeId)
      );

      return mutation;
    } finally {
      setIsDeleting(false);
    }
  }, [rowId, userId, queryClient]);

  return { deleteBarcode, isDeleting };
};

/**
 * Hook to update barcodes with offline-first support
 */
export const useOfflineUpdateBarcode = ({ rowId, userId }: UseOfflineBarcodesOptions) => {
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

  const updateBarcode = useCallback(async (
    barcodeId: string,
    oldCode: string,
    newCode: string,
    timestamp: string
  ) => {
    setIsUpdating(true);
    
    try {
      // Queue the update operation
      const mutation = await queueBarcodeUpdate(
        barcodeId,
        rowId,
        oldCode,
        newCode,
        timestamp,
        userId
      );

      // Optimistically update the UI
      queryClient.setQueryData<(Barcode | OfflineBarcode)[]>(
        ['barcodes', 'row', rowId],
        (old = []) => old.map(b => 
          b.id === barcodeId 
            ? { ...b, code: newCode, pendingCode: newCode }
            : b
        )
      );

      return mutation;
    } finally {
      setIsUpdating(false);
    }
  }, [rowId, userId, queryClient]);

  return { updateBarcode, isUpdating };
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
        const merged = await mergeBarcodesWithPending(serverBarcodes || [], rowId);
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
