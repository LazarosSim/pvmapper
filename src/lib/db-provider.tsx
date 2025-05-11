
import { createContext, useContext, useEffect, useState } from 'react';
import { useSupabase } from './supabase-provider';
import { toast } from 'sonner';

// Import types
import type { 
  User, Park, Row, Barcode, Progress, DailyScanStat, 
  UserStat, DBContextType 
} from './types/db-types';

// Import hooks
import { useUser } from './hooks/use-user';
import { useParks } from './hooks/use-parks';
import { useRows } from './hooks/rows/use-rows';
import { useBarcodes } from './hooks/use-barcodes';
import { useStats } from './hooks/use-stats';
import { useDataManagement } from './hooks/use-data-management';

// Extend the Row type to include captureLocation
export interface ExtendedRow extends Row {
  captureLocation?: boolean;
}

const DBContext = createContext<DBContextType | undefined>(undefined);

export function DBProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSupabase();
  
  // Initialize user state and functions
  const { 
    currentUser, isLoading: isDBLoading, users, setUsers,
    fetchUserProfile, refetchUser, register, logout, isManager
  } = useUser();

  // Initialize stats module (needed by barcodes)
  const {
    dailyScans, setDailyScans, fetchDailyScans, updateDailyScans,
    decreaseDailyScans, getUserDailyScans, getUserTotalScans, getUserBarcodesScanned,
    getAllUserStats, getDailyScans, getScansForDateRange
  } = useStats();
  
  // Initialize barcode state (needed by rows)
  const [barcodes, setBarcodes] = useState<Barcode[]>([]);
  
  // Initialize rows with barcode state
  const {
    rows, setRows, fetchRows, getRowsByParkId, addRow, addSubRow,
    updateRow, deleteRow, getRowById, resetRow, countBarcodesInRow
  } = useRows(barcodes, setBarcodes);
  
  // Initialize barcodes module with rows and daily scan update function
  const {
    fetchBarcodes, addBarcode, updateBarcode, deleteBarcode,
    getBarcodesByRowId, searchBarcodes, countBarcodesInPark
  } = useBarcodes(rows, barcodes, setBarcodes, () => updateDailyScans(user?.id), decreaseDailyScans);
  
  // Initialize parks module with dependencies
  const {
    parks, setParks, fetchParks, addPark, updatePark, 
    deletePark, getParkById, getParkProgress
  } = useParks(rows, countBarcodesInPark);
  
  // Initialize data management module
  const { importData, exportData } = useDataManagement(parks, rows, barcodes);

  // Load data when user changes
  useEffect(() => {
    let isMounted = true;
    
    const loadUserProfile = async () => {
      if (user?.id) {
        if (isMounted) {
          await fetchUserProfile(user.id);
          await fetchParks(user.id);
          await fetchRows(user.id);
          await fetchBarcodes(user.id);
          await fetchDailyScans(user.id);
        }
      } else {
        // No logged in user
        if (isMounted) {
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
    addRow: (parkId, expectedBarcodes, navigate) => 
      addRow(parkId, expectedBarcodes, navigate),
    deleteRow,
    updateRow,
    getRowById,
    resetRow: async (rowId) => {
      try {
        // Directly call the resetRow function that will now fetch from DB
        return await resetRow(rowId);
      } catch (error) {
        console.error('Error in resetRow:', error);
        return Promise.reject(error);
      }
    },
    countBarcodesInRow,
    addSubRow: (rowId, expectedBarcodes) => 
      addSubRow(rowId, expectedBarcodes),
    
    // Barcodes
    barcodes,
    addBarcode: (code, rowId, afterBarcodeIndex, location) => 
      addBarcode(code, rowId, afterBarcodeIndex, location, user?.id),
    deleteBarcode,
    updateBarcode,
    getBarcodesByRowId,
    searchBarcodes,
    countBarcodesInPark,
    
    // User management
    users,
    register,
    logout,
    
    // User stats - ensure we're passing the barcodes array to functions that need it
    getUserDailyScans: () => getUserDailyScans(user?.id),
    getUserTotalScans: () => getUserTotalScans(user?.id || '', barcodes),
    getUserBarcodesScanned: () => getUserBarcodesScanned(user?.id || '', barcodes),
    getAllUserStats: () => getAllUserStats(barcodes, users, user?.id, currentUser?.username),
    getDailyScans,
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
