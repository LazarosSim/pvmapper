/**
 * Hook for managing sync state and operations
 */

import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { executeSync, canSync } from '@/lib/offline/sync-manager';
import { getQueueCount } from '@/lib/offline/offline-queue';
import type { SyncState } from '@/lib/offline/types';

interface UseSyncReturn {
  syncState: SyncState;
  pendingCount: number;
  isSyncing: boolean;
  canStartSync: boolean;
  startSync: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

export const useSync = (): UseSyncReturn => {
  const queryClient = useQueryClient();
  
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    progress: 0,
    total: 0,
    error: null,
  });
  
  const [pendingCount, setPendingCount] = useState(0);
  const [canStartSync, setCanStartSync] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getQueueCount();
      setPendingCount(count);
      
      const syncPossible = await canSync();
      setCanStartSync(syncPossible);
    } catch (error) {
      console.error('Error refreshing pending count:', error);
    }
  }, []);

  // Refresh count on mount and periodically
  useEffect(() => {
    refreshPendingCount();
    
    const interval = setInterval(refreshPendingCount, 2000);
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  // Listen for online/offline changes
  useEffect(() => {
    const handleOnline = () => {
      refreshPendingCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOnline);
    };
  }, [refreshPendingCount]);

  const startSync = useCallback(async () => {
    if (syncState.isSyncing) {
      return;
    }

    if (!navigator.onLine) {
      toast.error('Cannot sync while offline');
      return;
    }

    const result = await executeSync((state) => {
      setSyncState(state);
    });

    if (result.success) {
      if (result.syncedCount > 0) {
        toast.success(`Synced ${result.syncedCount} barcode${result.syncedCount > 1 ? 's' : ''}`);
      } else {
        toast.info('Nothing to sync');
      }
      
      // Invalidate queries to refresh data from server
      queryClient.invalidateQueries({ queryKey: ['barcodes', 'row'] });
      queryClient.invalidateQueries({ queryKey: ['barcodes', 'park'] });
      queryClient.invalidateQueries({ queryKey: ['rows'] });
      queryClient.invalidateQueries({ queryKey: ['parks'] }); // Refresh park counts on Home page
    } else {
      toast.error(`Sync failed: ${result.error}`);
    }

    // Refresh count after sync
    await refreshPendingCount();
  }, [syncState.isSyncing, queryClient, refreshPendingCount]);

  return {
    syncState,
    pendingCount,
    isSyncing: syncState.isSyncing,
    canStartSync,
    startSync,
    refreshPendingCount,
  };
};
