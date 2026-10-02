/**
 * Hook for managing sync state and operations.
 *
 * Sync state lives in one module-level store shared by every component, so the
 * scan page sees a sync started from the floating button, and only one sync can
 * run at a time (also across browser tabs, via the Web Locks API when available).
 */

import { useCallback, useSyncExternalStore } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { executeSync, canSync } from '@/lib/offline/sync-manager';
import { getQueueCount } from '@/lib/offline/offline-queue';
import type { SyncState } from '@/lib/offline/types';

interface SyncSnapshot {
  syncState: SyncState;
  pendingCount: number;
  canStartSync: boolean;
}

interface UseSyncReturn extends SyncSnapshot {
  isSyncing: boolean;
  startSync: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

const POLL_INTERVAL_MS = 2000;

let snapshot: SyncSnapshot = {
  syncState: { isSyncing: false, progress: 0, total: 0, error: null },
  pendingCount: 0,
  canStartSync: false,
};
const listeners = new Set<() => void>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let inFlight: Promise<void> | null = null;

function setSnapshot(patch: Partial<SyncSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

async function refreshPendingCount(): Promise<void> {
  try {
    const pendingCount = await getQueueCount();
    const canStartSync = await canSync();
    if (pendingCount !== snapshot.pendingCount || canStartSync !== snapshot.canStartSync) {
      setSnapshot({ pendingCount, canStartSync });
    }
  } catch (error) {
    console.error('Error refreshing pending count:', error);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    refreshPendingCount();
    pollTimer = setInterval(refreshPendingCount, POLL_INTERVAL_MS);
    window.addEventListener('online', refreshPendingCount);
    window.addEventListener('offline', refreshPendingCount);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      window.removeEventListener('online', refreshPendingCount);
      window.removeEventListener('offline', refreshPendingCount);
    }
  };
}

const getSnapshot = () => snapshot;

async function runSync(queryClient: QueryClient): Promise<void> {
  const result = await executeSync((syncState) => setSnapshot({ syncState }));

  if (result.success) {
    if (result.syncedCount > 0) {
      toast.success(`Synced ${result.syncedCount} barcode${result.syncedCount > 1 ? 's' : ''}`);
    } else {
      toast.info('Nothing to sync');
    }

    // Invalidate queries to refresh data from server
    // Only invalidate barcodes and park counts — preserve cached row structure for offline workspace
    queryClient.invalidateQueries({ queryKey: ['barcodes', 'row'] });
    queryClient.invalidateQueries({ queryKey: ['barcodes', 'park'] });
    queryClient.invalidateQueries({ queryKey: ['parks'] }); // Refresh park counts on Home page
    // Refetch rows to update currentBarcodes counts without removing cached structure
    queryClient.refetchQueries({ queryKey: ['rows'] });
  } else {
    toast.error(`Sync failed: ${result.error}`);
  }

  await refreshPendingCount();
}

function startSyncOnce(queryClient: QueryClient): Promise<void> {
  if (inFlight) return inFlight;

  if (!navigator.onLine) {
    toast.error('Cannot sync while offline');
    return Promise.resolve();
  }

  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const run = locks
    ? locks.request('pvmapper-sync', { ifAvailable: true }, async (lock) => {
        // Another tab is already syncing the same queue.
        if (!lock) return;
        await runSync(queryClient);
      })
    : runSync(queryClient);

  inFlight = Promise.resolve(run).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export const useSync = (): UseSyncReturn => {
  const queryClient = useQueryClient();
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const startSync = useCallback(() => startSyncOnce(queryClient), [queryClient]);

  return {
    ...state,
    isSyncing: state.syncState.isSyncing,
    startSync,
    refreshPendingCount,
  };
};
