import {createContext, useContext, useEffect} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useSupabase} from './supabase-provider';
import {toast} from 'sonner';
import {forgetRow} from './local/repo';
import {syncNow} from './local/sync';
import {rescueLegacyServiceWorkerQueue} from './offline/legacy-sw-rescue';
import {supabaseRescueWriter} from './offline/legacy-sw-rescue-supabase';
import type {DBContextType, Row, User} from './types/db-types';
import {useUser} from './hooks/use-user';
import {addRow, addSubRow} from './hooks/rows/row-operations/add-row';
import {deleteRow, updateRow} from './hooks/rows/row-operations/update-row';

/**
 * The signed-in user and the row actions that need the server (create, rename, delete).
 * Barcodes are not here: they live in the phone's own database (src/lib/local).
 */
const DBContext = createContext<DBContextType | undefined>(undefined);

// The row actions keep their old signatures, which also updated an in-memory list that
// nothing reads any more.
const noLocalList = () => undefined;

export function DBProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSupabase();
  const queryClient = useQueryClient();
  const { currentUser, isLoading: isDBLoading, fetchUserProfile, refetchUser, logout, isManager } = useUser();

  // Row changes go straight to the server; refresh the phone's copy and server-only views
  const refreshAfterRowChange = () => {
    queryClient.invalidateQueries({ queryKey: ['server'] });
    syncNow().catch(() => undefined);
  };

  useEffect(() => {
    if (user?.id) {
      fetchUserProfile(user.id);
    } else {
      // No logged in user: drop cached server views so the next user never sees them.
      // Unsent scans stay in the phone's outbox.
      queryClient.clear();
      refetchUser();
    }
  }, [user?.id]);

  // Upload scans stranded in the previous service worker's queue (see legacy-sw-rescue.ts)
  useEffect(() => {
    if (!user?.id) return;

    const rescue = () => {
      if (!navigator.onLine) return;
      rescueLegacyServiceWorkerQueue(supabaseRescueWriter)
        .then((rescued) => {
          if (rescued > 0) refreshAfterRowChange();
        })
        .catch((error) => console.error('[LegacyRescue] Failed:', error));
    };

    rescue();
    window.addEventListener('online', rescue);
    return () => window.removeEventListener('online', rescue);
  }, [user?.id]);

  const contextValue: DBContextType = {
    currentUser,
    isDBLoading,
    refetchUser,
    logout,
    isManager,

    addRow: async (parkId, expectedBarcodes, navigate, customName) => {
      const row = await addRow([], noLocalList, parkId, expectedBarcodes, navigate, customName);
      refreshAfterRowChange();
      return row;
    },
    addSubRow: async (rowId, expectedBarcodes) => {
      const row = await addSubRow([], noLocalList, rowId, expectedBarcodes);
      refreshAfterRowChange();
      return row;
    },
    updateRow: async (rowId, name, expectedBarcodes) => {
      await updateRow([], noLocalList, rowId, name, expectedBarcodes);
      refreshAfterRowChange();
    },
    deleteRow: async (rowId) => {
      if (!navigator.onLine) {
        toast.error('Deleting a row needs a connection');
        return;
      }
      await deleteRow([], noLocalList, [], noLocalList, rowId);
      await forgetRow(rowId);
      refreshAfterRowChange();
    },
  };

  return (
    <DBContext.Provider value={contextValue}>
      {children}
    </DBContext.Provider>
  );
}

export { type User };
export type { Row };

export const useDB = () => {
  const context = useContext(DBContext);
  if (!context) {
    throw new Error('useDB must be used within a DBProvider');
  }
  return context;
};
