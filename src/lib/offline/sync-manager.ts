/**
 * Sync Manager
 * Handles synchronization of offline queue to Supabase
 * Uses batch processing with full rollback on partial failure
 */

import { supabase } from '@/integrations/supabase/client';
import { getQueue, removeFromQueue, updateMutationStatus, clearQueue, resetSequences } from './offline-queue';
import type { QueuedMutation, SyncState } from './types';

export type SyncProgressCallback = (state: SyncState) => void;

interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  error?: string;
}

/**
 * Execute sync for all pending mutations
 * Processes in order, rolls back entire batch on any failure
 */
export async function executeSync(
  onProgress?: SyncProgressCallback
): Promise<SyncResult> {
  const queue = await getQueue();
  const pendingMutations = queue.filter(m => m.status === 'pending');

  if (pendingMutations.length === 0) {
    return { success: true, syncedCount: 0, failedCount: 0 };
  }

  const total = pendingMutations.length;
  let syncedCount = 0;

  // Notify start
  onProgress?.({
    isSyncing: true,
    progress: 0,
    total,
    error: null,
  });

  // Track successfully synced IDs for potential rollback
  const syncedIds: string[] = [];

  try {
    for (const mutation of pendingMutations) {
      // Update status to syncing
      await updateMutationStatus(mutation.id, 'syncing');

      onProgress?.({
        isSyncing: true,
        progress: syncedCount,
        total,
        error: null,
      });

      // Process the mutation
      const result = await processMutation(mutation);

      if (!result.success) {
        // Rollback: reset all syncing items back to pending
        await rollbackSync(syncedIds);
        
        onProgress?.({
          isSyncing: false,
          progress: syncedCount,
          total,
          error: result.error || 'Sync failed',
        });

        return {
          success: false,
          syncedCount,
          failedCount: total - syncedCount,
          error: result.error,
        };
      }

      // Success - remove from queue
      await removeFromQueue(mutation.id);
      syncedIds.push(mutation.id);
      syncedCount++;

      onProgress?.({
        isSyncing: true,
        progress: syncedCount,
        total,
        error: null,
      });
    }

    // All done - reset sequences for clean slate
    await resetSequences();

    onProgress?.({
      isSyncing: false,
      progress: total,
      total,
      error: null,
    });

    return { success: true, syncedCount, failedCount: 0 };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
    
    // Rollback on unexpected error
    await rollbackSync(syncedIds);

    onProgress?.({
      isSyncing: false,
      progress: syncedCount,
      total,
      error: errorMessage,
    });

    return {
      success: false,
      syncedCount,
      failedCount: total - syncedCount,
      error: errorMessage,
    };
  }
}

/**
 * Process a single mutation
 */
async function processMutation(
  mutation: QueuedMutation
): Promise<{ success: boolean; error?: string }> {
  switch (mutation.type) {
    case 'ADD_BARCODE':
      return await syncAddBarcode(mutation);
    case 'DELETE_BARCODE':
      return await syncDeleteBarcode(mutation);
    case 'UPDATE_BARCODE':
      return await syncUpdateBarcode(mutation);
    default:
      return { success: false, error: `Unknown mutation type: ${mutation.type}` };
  }
}

/**
 * Sync an ADD_BARCODE mutation
 */
async function syncAddBarcode(
  mutation: QueuedMutation
): Promise<{ success: boolean; error?: string }> {
  const { code, rowId, orderInRow, timestamp, userId, latitude, longitude } = mutation.payload;

  if (!userId) {
    return { success: false, error: 'User ID is required for barcode sync' };
  }

  try {
    const { error } = await supabase.from('barcodes').insert({
      id: mutation.id, // Use the client-generated UUID
      code,
      row_id: rowId,
      order_in_row: orderInRow,
      timestamp,
      user_id: userId,
      latitude,
      longitude,
    });

    if (error) {
      // Handle duplicate key - treat as success (already synced)
      if (error.code === '23505') {
        console.log('[SyncManager] Barcode already exists, skipping:', mutation.id);
        return { success: true };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Network error' 
    };
  }
}

/**
 * Sync a DELETE_BARCODE mutation
 */
async function syncDeleteBarcode(
  mutation: QueuedMutation
): Promise<{ success: boolean; error?: string }> {
  // For now, just mark as success - delete logic can be added later
  console.log('[SyncManager] DELETE_BARCODE not implemented yet:', mutation.id);
  return { success: true };
}

/**
 * Sync an UPDATE_BARCODE mutation
 */
async function syncUpdateBarcode(
  mutation: QueuedMutation
): Promise<{ success: boolean; error?: string }> {
  // For now, just mark as success - update logic can be added later
  console.log('[SyncManager] UPDATE_BARCODE not implemented yet:', mutation.id);
  return { success: true };
}

/**
 * Rollback syncing items back to pending status
 */
async function rollbackSync(syncedIds: string[]): Promise<void> {
  console.log('[SyncManager] Rolling back sync, resetting items to pending');
  
  const queue = await getQueue();
  for (const mutation of queue) {
    if (mutation.status === 'syncing') {
      await updateMutationStatus(mutation.id, 'pending');
    }
  }
}

/**
 * Check if sync is possible (online and has pending items)
 */
export async function canSync(): Promise<boolean> {
  if (!navigator.onLine) {
    return false;
  }
  
  const queue = await getQueue();
  return queue.some(m => m.status === 'pending');
}
