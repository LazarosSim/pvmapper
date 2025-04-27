import { createContext, useContext, useEffect, useState } from 'react';
import { useSupabase } from './supabase-provider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Type Definitions
export type User = {
  id: string;
  username: string;
  role: string;
  createdAt: string;
};

export type Park = {
  id: string;
  name: string;
  expectedBarcodes: number;
  createdAt: string;
  userId: string;
};

export type Row = {
  id: string;
  name: string;
  parkId: string;
  createdAt: string;
};

export type Barcode = {
  id: string;
  code: string;
  rowId: string;
  userId: string;
  timestamp: string;
};

export type Progress = {
  completed: number;
  total: number;
  percentage: number;
};

type DBContextType = {
  currentUser: User | null | undefined;
  isDBLoading: boolean;
  refetchUser: () => Promise<void>;
  
  // Parks
  parks: Park[];
  addPark: (name: string, expectedBarcodes: number) => Promise<boolean>;
  deletePark: (parkId: string) => Promise<void>;
  updatePark: (parkId: string, name: string, expectedBarcodes: number) => Promise<void>;
  getParkById: (parkId: string) => Park | undefined;
  getParkProgress: (parkId: string) => Progress;
  
  // Rows
  rows: Row[];
  getRowsByParkId: (parkId: string) => Row[];
  addRow: (parkId: string) => Promise<Row | null>;
  deleteRow: (rowId: string) => Promise<void>;
  updateRow: (rowId: string, name: string) => Promise<void>;
  getRowById: (rowId: string) => Row | undefined;
  resetRow: (rowId: string) => Promise<void>;
  countBarcodesInRow: (rowId: string) => number;
  
  // Barcodes
  barcodes: Barcode[];
  addBarcode: (code: string, rowId: string) => Promise<void>;
  deleteBarcode: (barcodeId: string) => Promise<void>;
  updateBarcode: (barcodeId: string, code: string) => Promise<void>;
  getBarcodesByRowId: (rowId: string) => Barcode[];
  searchBarcodes: (query: string) => Barcode[];
  countBarcodesInPark: (parkId: string) => number;
  
  // User management
  users: User[];
  register: (username: string, password: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
  
  // User stats
  getUserDailyScans: () => number;
  getUserTotalScans: () => number;
  getUserBarcodesScanned: () => Barcode[];
  getAllUserStats: () => any[];
  
  // Data management
  importData: (jsonData: string) => boolean;
  exportData: () => string;
};

const DBContext = createContext<DBContextType | undefined>(undefined);

export function DBProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSupabase();
  const [currentUser, setCurrentUser] = useState<User | null | undefined>(undefined);
  const [isDBLoading, setIsDBLoading] = useState<boolean>(true);
  
  // State for data
  const [parks, setParks] = useState<Park[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [barcodes, setBarcodes] = useState<Barcode[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Fetch user profile data from the database
  const fetchUserProfile = async (userId: string) => {
    setIsDBLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, role, created_at')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        toast.error(`Failed to load profile: ${error.message}`);
        setCurrentUser(null);
        return null;
      }

      if (data) {
        const user: User = {
          id: data.id,
          username: data.username,
          role: data.role,
          createdAt: data.created_at
        };
        setCurrentUser(user);
        return user;
      }
      
      setCurrentUser(null);
      return null;
    } catch (error: any) {
      console.error('Error in fetchUserProfile:', error.message);
      setCurrentUser(null);
      return null;
    } finally {
      setIsDBLoading(false);
    }
  };
  
  // Fetch parks data
  const fetchParks = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('parks')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error fetching parks:', error);
        toast.error(`Failed to load parks: ${error.message}`);
        return;
      }
      
      if (data) {
        const formattedParks: Park[] = data.map(park => ({
          id: park.id,
          name: park.name,
          expectedBarcodes: park.expected_barcodes || 0,
          createdAt: park.created_at,
          userId: park.user_id
        }));
        
        setParks(formattedParks);
      }
    } catch (error: any) {
      console.error('Error in fetchParks:', error.message);
    }
  };
  
  // Fetch rows data
  const fetchRows = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('rows')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error fetching rows:', error);
        toast.error(`Failed to load rows: ${error.message}`);
        return;
      }
      
      if (data) {
        const formattedRows: Row[] = data.map(row => ({
          id: row.id,
          name: row.name,
          parkId: row.park_id,
          createdAt: row.created_at
        }));
        
        setRows(formattedRows);
      }
    } catch (error: any) {
      console.error('Error in fetchRows:', error.message);
    }
  };
  
  // Fetch barcodes data
  const fetchBarcodes = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('barcodes')
        .select('*')
        .order('timestamp', { ascending: false });
        
      if (error) {
        console.error('Error fetching barcodes:', error);
        toast.error(`Failed to load barcodes: ${error.message}`);
        return;
      }
      
      if (data) {
        const formattedBarcodes: Barcode[] = data.map(barcode => ({
          id: barcode.id,
          code: barcode.code,
          rowId: barcode.row_id,
          userId: barcode.user_id,
          timestamp: barcode.timestamp
        }));
        
        setBarcodes(formattedBarcodes);
      }
    } catch (error: any) {
      console.error('Error in fetchBarcodes:', error.message);
    }
  };

  // Refetch user profile
  const refetchUser = async () => {
    if (user?.id) {
      await fetchUserProfile(user.id);
    } else {
      setCurrentUser(null);
      setIsDBLoading(false);
    }
  };

  // Fetch all data when user changes
  useEffect(() => {
    let isMounted = true;
    
    const loadUserProfile = async () => {
      if (user?.id) {
        if (isMounted) {
          await fetchUserProfile(user.id);
          await fetchParks();
          await fetchRows();
          await fetchBarcodes();
        }
      } else {
        // No logged in user
        if (isMounted) {
          setCurrentUser(null);
          setParks([]);
          setRows([]);
          setBarcodes([]);
          setIsDBLoading(false);
        }
      }
    };
    
    loadUserProfile();
    
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Park operations
  const addPark = async (name: string, expectedBarcodes: number): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { data, error } = await supabase
        .from('parks')
        .insert([{ 
          name, 
          expected_barcodes: expectedBarcodes,
          user_id: user.id
        }])
        .select();
        
      if (error) {
        console.error('Error adding park:', error);
        toast.error(`Failed to create park: ${error.message}`);
        return false;
      }
      
      if (data && data[0]) {
        const newPark: Park = {
          id: data[0].id,
          name: data[0].name,
          expectedBarcodes: data[0].expected_barcodes || 0,
          createdAt: data[0].created_at,
          userId: data[0].user_id
        };
        
        setParks(prev => [newPark, ...prev]);
        toast.success('Park created successfully');
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('Error in addPark:', error.message);
      toast.error(`Failed to create park: ${error.message}`);
      return false;
    }
  };
  
  const updatePark = async (parkId: string, name: string, expectedBarcodes: number) => {
    try {
      const { error } = await supabase
        .from('parks')
        .update({ 
          name, 
          expected_barcodes: expectedBarcodes 
        })
        .eq('id', parkId);
        
      if (error) {
        console.error('Error updating park:', error);
        toast.error(`Failed to update park: ${error.message}`);
        return;
      }
      
      setParks(prev => prev.map(park => 
        park.id === parkId 
          ? { ...park, name, expectedBarcodes } 
          : park
      ));
      
      toast.success('Park updated successfully');
    } catch (error: any) {
      console.error('Error in updatePark:', error.message);
      toast.error(`Failed to update park: ${error.message}`);
    }
  };
  
  const deletePark = async (parkId: string) => {
    try {
      const { error } = await supabase
        .from('parks')
        .delete()
        .eq('id', parkId);
        
      if (error) {
        console.error('Error deleting park:', error);
        toast.error(`Failed to delete park: ${error.message}`);
        return;
      }
      
      // Remove park and its associated rows and barcodes
      setParks(prev => prev.filter(park => park.id !== parkId));
      
      const parkRows = rows.filter(row => row.parkId === parkId);
      const rowIds = parkRows.map(row => row.id);
      
      setRows(prev => prev.filter(row => row.parkId !== parkId));
      setBarcodes(prev => prev.filter(barcode => !rowIds.includes(barcode.rowId)));
      
      toast.success('Park deleted successfully');
    } catch (error: any) {
      console.error('Error in deletePark:', error.message);
      toast.error(`Failed to delete park: ${error.message}`);
    }
  };
  
  const getParkById = (parkId: string): Park | undefined => {
    return parks.find(park => park.id === parkId);
  };
  
  const getParkProgress = (parkId: string): Progress => {
    const park = parks.find(park => park.id === parkId);
    const parkRows = rows.filter(row => row.parkId === parkId);
    const rowIds = parkRows.map(row => row.id);
    const parkBarcodes = barcodes.filter(barcode => rowIds.includes(barcode.rowId));
    
    const completed = parkBarcodes.length;
    const total = park?.expectedBarcodes || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  };
  
  // Row operations
  const getRowsByParkId = (parkId: string): Row[] => {
    return rows.filter(row => row.parkId === parkId);
  };
  
  const addRow = async (parkId: string): Promise<Row | null> => {
    if (!user) return null;
    
    // Get rows count for this park to create a sequential name
    const parkRows = rows.filter(row => row.parkId === parkId);
    const rowNumber = parkRows.length + 1;
    const rowName = `Row ${rowNumber}`;
    
    try {
      const { data, error } = await supabase
        .from('rows')
        .insert([{ 
          name: rowName,
          park_id: parkId
        }])
        .select();
        
      if (error) {
        console.error('Error adding row:', error);
        toast.error(`Failed to create row: ${error.message}`);
        return null;
      }
      
      if (data && data[0]) {
        const newRow: Row = {
          id: data[0].id,
          name: data[0].name,
          parkId: data[0].park_id,
          createdAt: data[0].created_at
        };
        
        setRows(prev => [newRow, ...prev]);
        toast.success('Row added successfully');
        return newRow;
      }
      
      return null;
    } catch (error: any) {
      console.error('Error in addRow:', error.message);
      toast.error(`Failed to create row: ${error.message}`);
      return null;
    }
  };
  
  const updateRow = async (rowId: string, name: string) => {
    try {
      const { error } = await supabase
        .from('rows')
        .update({ name })
        .eq('id', rowId);
        
      if (error) {
        console.error('Error updating row:', error);
        toast.error(`Failed to update row: ${error.message}`);
        return;
      }
      
      setRows(prev => prev.map(row => 
        row.id === rowId 
          ? { ...row, name } 
          : row
      ));
      
      toast.success('Row updated successfully');
    } catch (error: any) {
      console.error('Error in updateRow:', error.message);
      toast.error(`Failed to update row: ${error.message}`);
    }
  };
  
  const deleteRow = async (rowId: string) => {
    try {
      const { error } = await supabase
        .from('rows')
        .delete()
        .eq('id', rowId);
        
      if (error) {
        console.error('Error deleting row:', error);
        toast.error(`Failed to delete row: ${error.message}`);
        return;
      }
      
      // Remove row and its barcodes
      setRows(prev => prev.filter(row => row.id !== rowId));
      setBarcodes(prev => prev.filter(barcode => barcode.rowId !== rowId));
      
      toast.success('Row deleted successfully');
    } catch (error: any) {
      console.error('Error in deleteRow:', error.message);
      toast.error(`Failed to delete row: ${error.message}`);
    }
  };
  
  const getRowById = (rowId: string): Row | undefined => {
    return rows.find(row => row.id === rowId);
  };
  
  const resetRow = async (rowId: string) => {
    try {
      // Delete all barcodes for this row
      const { error } = await supabase
        .from('barcodes')
        .delete()
        .eq('row_id', rowId);
        
      if (error) {
        console.error('Error resetting row:', error);
        toast.error(`Failed to reset row: ${error.message}`);
        return;
      }
      
      // Remove barcodes from state
      setBarcodes(prev => prev.filter(barcode => barcode.rowId !== rowId));
      
      toast.success('Row reset successfully');
    } catch (error: any) {
      console.error('Error in resetRow:', error.message);
      toast.error(`Failed to reset row: ${error.message}`);
    }
  };
  
  const countBarcodesInRow = (rowId: string): number => {
    return barcodes.filter(barcode => barcode.rowId === rowId).length;
  };
  
  // Barcode operations
  const addBarcode = async (code: string, rowId: string) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('barcodes')
        .insert([{ 
          code,
          row_id: rowId,
          user_id: user.id
        }])
        .select();
        
      if (error) {
        console.error('Error adding barcode:', error);
        toast.error(`Failed to add barcode: ${error.message}`);
        return;
      }
      
      if (data && data[0]) {
        const newBarcode: Barcode = {
          id: data[0].id,
          code: data[0].code,
          rowId: data[0].row_id,
          userId: data[0].user_id,
          timestamp: data[0].timestamp
        };
        
        setBarcodes(prev => [newBarcode, ...prev]);
        
        // Update daily scans
        updateDailyScans();
        
        toast.success('Barcode added successfully');
      }
    } catch (error: any) {
      console.error('Error in addBarcode:', error.message);
      toast.error(`Failed to add barcode: ${error.message}`);
    }
  };
  
  const updateBarcode = async (barcodeId: string, code: string) => {
    try {
      const { error } = await supabase
        .from('barcodes')
        .update({ code })
        .eq('id', barcodeId);
        
      if (error) {
        console.error('Error updating barcode:', error);
        toast.error(`Failed to update barcode: ${error.message}`);
        return;
      }
      
      setBarcodes(prev => prev.map(barcode => 
        barcode.id === barcodeId 
          ? { ...barcode, code } 
          : barcode
      ));
      
      toast.success('Barcode updated successfully');
    } catch (error: any) {
      console.error('Error in updateBarcode:', error.message);
      toast.error(`Failed to update barcode: ${error.message}`);
    }
  };
  
  const deleteBarcode = async (barcodeId: string) => {
    try {
      const { error } = await supabase
        .from('barcodes')
        .delete()
        .eq('id', barcodeId);
        
      if (error) {
        console.error('Error deleting barcode:', error);
        toast.error(`Failed to delete barcode: ${error.message}`);
        return;
      }
      
      setBarcodes(prev => prev.filter(barcode => barcode.id !== barcodeId));
      
      toast.success('Barcode deleted successfully');
    } catch (error: any) {
      console.error('Error in deleteBarcode:', error.message);
      toast.error(`Failed to delete barcode: ${error.message}`);
    }
  };
  
  const getBarcodesByRowId = (rowId: string): Barcode[] => {
    return barcodes.filter(barcode => barcode.rowId === rowId);
  };
  
  const searchBarcodes = (query: string): Barcode[] => {
    if (!query.trim()) return [];
    
    return barcodes.filter(barcode => 
      barcode.code.toLowerCase().includes(query.toLowerCase())
    );
  };
  
  const countBarcodesInPark = (parkId: string): number => {
    const parkRows = rows.filter(row => row.parkId === parkId);
    const rowIds = parkRows.map(row => row.id);
    
    return barcodes.filter(barcode => rowIds.includes(barcode.rowId)).length;
  };
  
  // User stats
  const updateDailyScans = async () => {
    if (!user) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // Check if entry exists for today
      const { data, error } = await supabase
        .from('daily_scans')
        .select()
        .eq('user_id', user.id)
        .eq('date', today)
        .single();
        
      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Error checking daily scans:', error);
        return;
      }
      
      if (data) {
        // Update existing entry
        await supabase
          .from('daily_scans')
          .update({ count: data.count + 1 })
          .eq('id', data.id);
      } else {
        // Create new entry
        await supabase
          .from('daily_scans')
          .insert([{ 
            user_id: user.id,
            count: 1,
            date: today
          }]);
      }
    } catch (error: any) {
      console.error('Error updating daily scans:', error.message);
    }
  };
  
  const getUserDailyScans = (): number => {
    return 0; // Placeholder for future implementation
  };
  
  const getUserTotalScans = (): number => {
    if (!user) return 0;
    return barcodes.filter(barcode => barcode.userId === user.id).length;
  };
  
  const getUserBarcodesScanned = (): Barcode[] => {
    if (!user) return [];
    return barcodes.filter(barcode => barcode.userId === user.id);
  };
  
  const getAllUserStats = () => {
    return []; // Placeholder for future implementation
  };
  
  // User management
  const register = async (username: string, password: string, role: string) => {
    // Implementation would be added here
  };
  
  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error logging out:', error);
        toast.error(`Failed to logout: ${error.message}`);
        return;
      }
      
      toast.success('Logged out successfully');
    } catch (error: any) {
      console.error('Error in logout:', error.message);
      toast.error(`Failed to logout: ${error.message}`);
    }
  };
  
  // Data management
  const importData = (jsonData: string): boolean => {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.parks) setParks(data.parks);
      if (data.rows) setRows(data.rows);
      if (data.barcodes) setBarcodes(data.barcodes);
      
      toast.success('Data imported successfully');
      return true;
    } catch (error: any) {
      console.error('Error importing data:', error.message);
      toast.error(`Failed to import data: ${error.message}`);
      return false;
    }
  };
  
  const exportData = (): string => {
    const data = {
      parks,
      rows,
      barcodes,
      exportDate: new Date().toISOString()
    };
    
    return JSON.stringify(data, null, 2);
  };

  // Create context value
  const contextValue: DBContextType = {
    currentUser,
    isDBLoading,
    refetchUser,
    
    // Parks
    parks,
    addPark,
    deletePark,
    updatePark,
    getParkById,
    getParkProgress,
    
    // Rows
    rows,
    getRowsByParkId,
    addRow,
    deleteRow,
    updateRow,
    getRowById,
    resetRow,
    countBarcodesInRow,
    
    // Barcodes
    barcodes,
    addBarcode,
    deleteBarcode,
    updateBarcode,
    getBarcodesByRowId,
    searchBarcodes,
    countBarcodesInPark,
    
    // User management
    users,
    register,
    logout,
    
    // User stats
    getUserDailyScans,
    getUserTotalScans,
    getUserBarcodesScanned,
    getAllUserStats,
    
    // Data management
    importData,
    exportData
  };

  return (
    <DBContext.Provider value={contextValue}>
      {children}
    </DBContext.Provider>
  );
}

export const useDB = () => {
  const context = useContext(DBContext);
  if (!context) {
    throw new Error('useDB must be used within a DBProvider');
  }
  return context;
};
