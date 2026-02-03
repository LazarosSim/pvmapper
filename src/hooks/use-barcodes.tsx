/**
 * Unified Barcode Hooks
 * 
 * This file provides a single entry point for all barcode-related hooks.
 * Use these hooks instead of importing from individual files.
 * 
 * Usage:
 * - For reading barcodes: useRowBarcodes, useParkBarcodes
 * - For offline-aware reading: useOfflineAwareRowBarcodes
 * - For mutations: useAddBarcode, useDeleteBarcode, useUpdateBarcode
 * - For search: useSearchBarcodes
 */

// Re-export query hooks
export {
  useRowBarcodes,
  useParkBarcodes,
  useAddBarcodeToRow,
  useUpdateRowBarcode,
  useDeleteRowBarcode,
  useResetRowBarcodes,
} from './use-barcodes-queries';

// Re-export offline hooks
export {
  useOfflineAddBarcode,
  useOfflineDeleteBarcode,
  useOfflineUpdateBarcode,
  usePendingCount,
  useMergedBarcodes,
  mergeBarcodesWithPending,
  mergeBarcodesWithPendingSimple,
  type MergedBarcode,
} from './use-offline-barcodes';

// Re-export search hook
export { useSearchBarcodes } from './use-search-barcodes';

// Re-export sync hook
export { useSync } from './use-sync';

import { useRowBarcodes } from './use-barcodes-queries';
import { useMergedBarcodes, type MergedBarcode } from './use-offline-barcodes';
import type { Barcode } from '@/lib/types/db-types';

/**
 * Hook that combines server barcodes with pending offline mutations
 * Use this for offline-aware barcode display in scan pages
 */
export const useOfflineAwareRowBarcodes = (rowId: string) => {
  const { data: serverBarcodes, isLoading: isServerLoading, error, refetch } = useRowBarcodes(rowId);
  const { mergedBarcodes, isLoading: isMergeLoading } = useMergedBarcodes(rowId, serverBarcodes);

  return {
    barcodes: mergedBarcodes,
    isLoading: isServerLoading || isMergeLoading,
    error,
    refetch,
    // Also expose the raw server data if needed
    serverBarcodes,
  };
};
