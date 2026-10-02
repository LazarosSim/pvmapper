import {createContext, useContext, useEffect, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useSupabase} from './supabase-provider';
import {toast} from 'sonner';
import {removeQueuedMutationsByRow} from './offline/offline-queue';
import {rescueLegacyServiceWorkerQueue} from './offline/legacy-sw-rescue';
import {supabaseRescueWriter} from './offline/legacy-sw-rescue-supabase';

// Import types
import type {Barcode, DBContextType, Park, Row, User} from './types/db-types';

// Import hooks
import {useUser} from './hooks/use-user';
import {useParks} from './hooks/use-parks';
import {useRows} from './hooks/rows/use-rows';
import {useBarcodes} from './hooks/use-barcodes';
import {useStats} from './hooks/use-stats';
import {useDataManagement} from './hooks/use-data-management';

// Extend the Row type to include captureLocation
export interface ExtendedRow extends Row {
  captureLocation?: boolean;
}

const DBContext = createContext<DBContextType | undefined>(undefined);

export function DBProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSupabase();
  const queryClient = useQueryClient();

  // Row changes go straight to the server; refresh the cached lists the pages read from.
  const refreshRowQueries = (rowId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['rows'] });
    queryClient.invalidateQueries({ queryKey: ['parks'] });
    queryClient.invalidateQueries({ queryKey: ['park'] });
    if (rowId) queryClient.invalidateQueries({ queryKey: ['barcodes', 'row', rowId] });
  };
  
  // Initialize user state and functions
  const { 
    currentUser, isLoading: isDBLoading, users, setUsers,
    fetchUserProfile, refetchUser, logout, isManager
  } = useUser();

  // Initialize stats module (needed by barcodes)
  const {
    dailyScans, setDailyScans, fetchDailyScans, updateDailyScans,
    decreaseDailyScans, getUserDailyScans, getUserTotalScans, getUserBarcodesScanned,
    getAllUserStats, getDailyScans, getScansForDateRange
  } = useStats();
  
  // Legacy barcode state - kept for backward compatibility but no longer fetched globally
  // @deprecated Use React Query hooks (useRowBarcodes, useParkBarcodes) instead
  const [barcodes, setBarcodes] = useState<Barcode[]>([]);
  
  // Initialize rows with barcode state
  const {
    rows, setRows, fetchRows, getRowsByParkId, addRow, addSubRow,
    updateRow, deleteRow, getRowById, resetRow, countBarcodesInRow
  } = useRows(barcodes, setBarcodes);
  
  // Initialize barcodes module with rows and daily scan update function
  // Note: fetchBarcodes is no longer called globally - individual pages use React Query
  const {
    updateBarcode, deleteBarcode, searchBarcodes, countBarcodesInPark
  } = useBarcodes(rows, () => updateDailyScans(user?.id), decreaseDailyScans);
  
  // Initialize parks module with dependencies
  const {
    parks, setParks, fetchParks, addPark, updatePark, 
    deletePark, getParkById, getParkProgress
  } = useParks(rows, countBarcodesInPark);
  
  // Initialize data management module
  const { importData, exportData, fetchBarcodesForRow } = useDataManagement(parks, rows, barcodes);

  // Load data when user changes
  // Note: Rows and Barcodes are no longer fetched globally - pages use React Query hooks
  // (useRowsByParkId, useRowBarcodes, useParkBarcodes)
  useEffect(() => {
    let isMounted = true;
    
    const loadUserProfile = async () => {
      if (user?.id) {
        if (isMounted) {
          await fetchUserProfile(user.id);
          await fetchParks(user.id);
          // Note: fetchRows removed - pages now use React Query (useRowsByParkId)
          // Note: fetchBarcodes removed - pages now use React Query (useRowBarcodes, useParkBarcodes)
          await fetchDailyScans(user.id);
        }
      } else {
        // No logged in user: drop cached server data so the next user never sees it.
        // Unsynced scans are kept in the offline queue, not in this cache.
        if (isMounted) {
          queryClient.clear();
          refetchUser();
          setParks([]);
          setRows([]);
          setBarcodes([]);
          setDailyScans([]);
        }
      }
    };
    
    loadUserProfile();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Upload scans stranded in the previous service worker's queue (see legacy-sw-rescue.ts)
  useEffect(() => {
    if (!user?.id) return;

    const rescue = () => {
      if (!navigator.onLine) return;
      rescueLegacyServiceWorkerQueue(supabaseRescueWriter)
        .then((rescued) => {
          if (rescued > 0) {
            queryClient.invalidateQueries({ queryKey: ['barcodes'] });
            refreshRowQueries();
          }
        })
        .catch((error) => console.error('[LegacyRescue] Failed:', error));
    };

    rescue();
    window.addEventListener('online', rescue);
    return () => window.removeEventListener('online', rescue);
  }, [user?.id]);

  // Create context value with all the functions and state
  const contextValue: DBContextType = {
    currentUser,
    isDBLoading,
    refetchUser,
    
    // Parks
    parks,
    addPark: (name, expectedBarcodes, validateBarcodeLength) => {
      // Only allow managers to add parks
      if (!isManager()) {
        toast.error('Only managers can add parks');
        return Promise.resolve(false);
      }
      return addPark(name, expectedBarcodes, validateBarcodeLength, user?.id);
    },
    deletePark: (parkId) => {
      // Only allow managers to delete parks
      if (!isManager()) {
        toast.error('Only managers can delete parks');
        return Promise.resolve();
      }
      return deletePark(parkId);
    },
    updatePark,
    getParkById,
    getParkProgress,
    
    // Rows
    rows,
    getRowsByParkId,
    addRow: async (parkId, expectedBarcodes, navigate, customName) => {
      const row = await addRow(parkId, expectedBarcodes, navigate, customName);
      refreshRowQueries();
      return row;
    },
    deleteRow: async (rowId) => {
      // The user confirmed deleting the row and all of its barcodes, including ones
      // not uploaded yet. Left in the queue they would fail to sync forever.
      await removeQueuedMutationsByRow(rowId);
      await deleteRow(rowId);
      refreshRowQueries(rowId);
    },
    updateRow: async (rowId, name, expectedBarcodes) => {
      await updateRow(rowId, name, expectedBarcodes);
      refreshRowQueries(rowId);
    },
    getRowById,
    resetRow: async (rowId) => {
      try {
        // Directly call the resetRow function that will now fetch from DB
        const result = await resetRow(rowId);
        refreshRowQueries(rowId);
        return result;
      } catch (error) {
        console.error('Error in resetRow:', error);
        return Promise.reject(error);
      }
    },
    countBarcodesInRow,
    addSubRow: async (rowId, expectedBarcodes) => {
      const row = await addSubRow(rowId, expectedBarcodes);
      refreshRowQueries();
      return row;
    },
    
    // Barcodes
    barcodes,
    deleteBarcode,
    updateBarcode,
    searchBarcodes,
    countBarcodesInPark,
    // User management
    users,
    logout,
    getScansForDateRange,
    
    // Data management
    importData,
    exportData,
    
    // Helper function
    isManager
  };

  return (
    <DBContext.Provider value={contextValue}>
      {children}
    </DBContext.Provider>
  );
}

export { type User, type Park, type Barcode };
export type { ExtendedRow as Row };

export const useDB = () => {
  const context = useContext(DBContext);
  if (!context) {
    throw new Error('useDB must be used within a DBProvider');
  }
  return context;
};
