import { createContext, useContext, useEffect, useState } from 'react';
import { useSupabase } from './supabase-provider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

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
  validateBarcodeLength?: boolean;
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
  displayOrder: number;
};

export type Progress = {
  completed: number;
  total: number;
  percentage: number;
};

export type DailyScanStat = {
  date: string;
  count: number;
  userId: string;
  username?: string;
}

export type UserStat = {
  userId: string;
  username: string;
  totalScans: number;
  dailyScans: number;
  daysActive: number;
  averageScansPerDay: number;
};

type DBContextType = {
  currentUser: User | null | undefined;
  isDBLoading: boolean;
  refetchUser: () => Promise<void>;
  
  // Parks
  parks: Park[];
  addPark: (name: string, expectedBarcodes: number, validateBarcodeLength?: boolean) => Promise<boolean>;
  deletePark: (parkId: string) => Promise<void>;
  updatePark: (parkId: string, name: string, expectedBarcodes: number, validateBarcodeLength: boolean) => Promise<void>;
  getParkById: (parkId: string) => Park | undefined;
  getParkProgress: (parkId: string) => Progress;
  
  // Rows
  rows: Row[];
  getRowsByParkId: (parkId: string) => Row[];
  addRow: (parkId: string, navigate?: boolean) => Promise<Row | null>;
  deleteRow: (rowId: string) => Promise<void>;
  updateRow: (rowId: string, name: string) => Promise<void>;
  getRowById: (rowId: string) => Row | undefined;
  resetRow: (rowId: string) => Promise<void>;
  countBarcodesInRow: (rowId: string) => number;
  addSubRow: (rowId: string) => Promise<Row | null>;
  
  // Barcodes
  barcodes: Barcode[];
  addBarcode: (code: string, rowId: string, afterBarcodeIndex?: number) => Promise<Barcode | null>;
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
  getAllUserStats: () => UserStat[];
  getDailyScans: (date?: Date) => Promise<DailyScanStat[]>;
  getScansForDateRange: (startDate: Date, endDate: Date) => Promise<{date: string, count: number}[]>;
  
  // Data management
  importData: (jsonData: string) => boolean;
  exportData: () => string;

  // Helper function
  isManager: () => boolean;
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
  const [dailyScans, setDailyScans] = useState<DailyScanStat[]>([]);

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
          userId: park.user_id,
          validateBarcodeLength: park.validate_barcode_length
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
        .order('display_order', { ascending: true });
        
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
          timestamp: barcode.timestamp,
          displayOrder: barcode.display_order || 0
        }));
        
        setBarcodes(formattedBarcodes);
      }
    } catch (error: any) {
      console.error('Error in fetchBarcodes:', error.message);
    }
  };

  // Fetch daily scans data
  const fetchDailyScans = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('daily_scans')
        .select('*')
        .order('date', { ascending: false });
        
      if (error) {
        console.error('Error fetching daily scans:', error);
        return;
      }
      
      if (data) {
        // Get all user profiles to map IDs to usernames
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username');
          
        const usernameMap = profiles ? 
          profiles.reduce((map: {[key: string]: string}, profile) => {
            map[profile.id] = profile.username;
            return map;
          }, {}) : {};
          
        const formattedScans: DailyScanStat[] = data.map(scan => ({
          date: scan.date,
          count: scan.count,
          userId: scan.user_id,
          username: usernameMap[scan.user_id] || 'Unknown'
        }));
        
        setDailyScans(formattedScans);
      }
    } catch (error: any) {
      console.error('Error in fetchDailyScans:', error.message);
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
          await fetchDailyScans();
        }
      } else {
        // No logged in user
        if (isMounted) {
          setCurrentUser(null);
          setParks([]);
          setRows([]);
          setBarcodes([]);
          setDailyScans([]);
          setIsDBLoading(false);
        }
      }
    };
    
    loadUserProfile();
    
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Helper function to check if current user is a manager
  const isManager = () => {
    return currentUser?.role === 'manager' || currentUser?.role === 'admin';
  };

  // Park operations
  const addPark = async (name: string, expectedBarcodes: number, validateBarcodeLength: boolean = false): Promise<boolean> => {
    if (!user) return false;
    
    // Check if the user is a manager, if not, deny permission
    if (!isManager()) {
      toast.error('Only managers can create parks');
      return false;
    }
    
    try {
      const { data, error } = await supabase
        .from('parks')
        .insert([{ 
          name, 
          expected_barcodes: expectedBarcodes,
          user_id: user.id,
          validate_barcode_length: validateBarcodeLength
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
          userId: data[0].user_id,
          validateBarcodeLength: data[0].validate_barcode_length
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
  
  const updatePark = async (parkId: string, name: string, expectedBarcodes: number, validateBarcodeLength: boolean = false) => {
    try {
      const { error } = await supabase
        .from('parks')
        .update({ 
          name, 
          expected_barcodes: expectedBarcodes,
          validate_barcode_length: validateBarcodeLength
        })
        .eq('id', parkId);
        
      if (error) {
        console.error('Error updating park:', error);
        toast.error(`Failed to update park: ${error.message}`);
        return;
      }
      
      setParks(prev => prev.map(park => 
        park.id === parkId 
          ? { ...park, name, expectedBarcodes, validateBarcodeLength } 
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
  
  const addRow = async (parkId: string, navigate: boolean = true): Promise<Row | null> => {
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

  const addSubRow = async (parentRowId: string): Promise<Row | null> => {
    if (!user) return null;
    
    // Get the original row
    const originalRow = rows.find(row => row.id === parentRowId);
    if (!originalRow) {
      toast.error('Parent row not found');
      return null;
    }
    
    // Extract the base row name (get the row number)
    const baseNameMatch = originalRow.name.match(/^Row\s+(\d+)(?:_[a-z])?$/i);
    if (!baseNameMatch) {
      toast.error('Unable to determine parent row base name');
      return null;
    }
    
    const rowNumber = baseNameMatch[1];
    const parkId = originalRow.parkId;
    
    // Find all related rows with the same base number
    const relatedRows = rows.filter(row => {
      const match = row.name.match(/^Row\s+(\d+)(?:_([a-z]))?$/i);
      return match && match[1] === rowNumber && row.parkId === parkId;
    });
    
    // Check if we need to rename the original row (first time adding a subrow)
    const hasSubRows = relatedRows.some(row => row.name.includes('_'));
    
    if (!hasSubRows && originalRow.name === `Row ${rowNumber}`) {
      // Rename original row to Row X_a first
      await updateRow(originalRow.id, `Row ${rowNumber}_a`);
      
      // Add the newly renamed row to our relatedRows array
      relatedRows.push({...originalRow, name: `Row ${rowNumber}_a`});
    }
    
    // Determine the next suffix letter to use
    let nextSuffix = 'a';
    const suffixes = relatedRows
      .map(row => {
        const match = row.name.match(/^Row\s+\d+_([a-z])$/i);
        return match ? match[1].toLowerCase() : '';
      })
      .filter(Boolean);
    
    if (suffixes.length > 0) {
      // Get the last letter and increment it
      const lastLetter = String.fromCharCode(
        Math.max(...suffixes.map(s => s.charCodeAt(0)))
      );
      nextSuffix = String.fromCharCode(lastLetter.charCodeAt(0) + 1);
    }
    
    // Create new row with the next suffix
    const newRowName = `Row ${rowNumber}_${nextSuffix}`;
    
    try {
      const { data, error } = await supabase
        .from('rows')
        .insert([{ 
          name: newRowName,
          park_id: parkId
        }])
        .select();
        
      if (error) {
        console.error('Error adding subrow:', error);
        toast.error(`Failed to create subrow: ${error.message}`);
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
        toast.success('Subrow added successfully');
        return newRow;
      }
      
      return null;
    } catch (error: any) {
      console.error('Error in addSubRow:', error.message);
      toast.error(`Failed to create subrow: ${error.message}`);
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
      // First reset the row (which will handle adjusting barcode counts)
      await resetRow(rowId);
      
      // Then delete the row
      const { error } = await supabase
        .from('rows')
        .delete()
        .eq('id', rowId);
        
      if (error) {
        console.error('Error deleting row:', error);
        toast.error(`Failed to delete row: ${error.message}`);
        return;
      }
      
      // Remove row from state
      setRows(prev => prev.filter(row => row.id !== rowId));
      
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
      // First get all barcodes for this row to track what needs to be subtracted
      const rowBarcodes = barcodes.filter(barcode => barcode.rowId === rowId);
      
      // Group barcodes by user and date for adjustment
      const userBarcodeCounts: {[key: string]: number} = {};
      
      // Format: userId_date -> count
      rowBarcodes.forEach(barcode => {
        const scanDate = new Date(barcode.timestamp).toISOString().split('T')[0];
        const key = `${barcode.userId}_${scanDate}`;
        
        if (!userBarcodeCounts[key]) {
          userBarcodeCounts[key] = 0;
        }
        userBarcodeCounts[key]++;
      });
      
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
      
      // Adjust daily scans for each affected user and date
      for (const [key, count] of Object.entries(userBarcodeCounts)) {
        const [userId, date] = key.split('_');
        
        // Get current daily scan count
        const { data: scanData } = await supabase
          .from('daily_scans')
          .select('id, count')
          .eq('user_id', userId)
          .eq('date', date)
          .maybeSingle();
          
        if (scanData) {
          // Subtract the count - this can result in negative values
          const newCount = Math.max(scanData.count - count, -999999);
          
          await supabase
            .from('daily_scans')
            .update({ count: newCount })
            .eq('id', scanData.id);
            
          // Update local state
          setDailyScans(prev => prev.map(scan => 
            scan.userId === userId && scan.date === date
              ? { ...scan, count: newCount }
              : scan
          ));
        }
      }
      
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
  const addBarcode = async (code: string, rowId: string, afterBarcodeIndex?: number) => {
    if (!user) return;
    
    try {
      // Get barcodes for this row to determine display order
      const rowBarcodes = barcodes
        .filter(barcode => barcode.rowId === rowId)
        .sort((a, b) => a.displayOrder - b.displayOrder);
      
      // Determine the new display order
      let newDisplayOrder = 0;
      
      if (rowBarcodes.length > 0) {
        if (afterBarcodeIndex !== undefined && afterBarcodeIndex >= 0 && afterBarcodeIndex < rowBarcodes.length) {
          // Insert after the specified barcode
          const afterBarcode = rowBarcodes[afterBarcodeIndex];
          const laterBarcodes = rowBarcodes.filter(b => b.displayOrder > afterBarcode.displayOrder);
          
          if (laterBarcodes.length > 0) {
            const nextBarcode = laterBarcodes[0];
            newDisplayOrder = (afterBarcode.displayOrder + nextBarcode.displayOrder) / 2;
          } else {
            newDisplayOrder = afterBarcode.displayOrder + 1000;
          }
        } else {
          // Add to beginning with smaller display order
          newDisplayOrder = rowBarcodes[0].displayOrder - 1000;
        }
      }
      
      const { data, error } = await supabase
        .from('barcodes')
        .insert([{ 
          code,
          row_id: rowId,
          user_id: user.id,
          display_order: newDisplayOrder
        }])
        .select();
        
      if (error) {
        console.error('Error adding barcode:', error);
        toast.error(`Failed to add barcode: ${error.message}`);
        return null;
      }
      
      if (data && data[0]) {
        const newBarcode: Barcode = {
          id: data[0].id,
          code: data[0].code,
          rowId: data[0].row_id,
          userId: data[0].user_id,
          timestamp: data[0].timestamp,
          displayOrder: data[0].display_order || 0
        };
        
        setBarcodes(prev => [newBarcode, ...prev]);
        await updateDailyScans();
        return newBarcode;
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
    return barcodes
      .filter(barcode => barcode.rowId === rowId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
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
        .maybeSingle();
        
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
          
        // Update local data
        setDailyScans(prev => prev.map(scan => 
          scan.userId === user.id && scan.date === today 
            ? { ...scan, count: scan.count + 1 } 
            : scan
        ));
      } else {
        // Create new entry
        const { data: newScan } = await supabase
          .from('daily_scans')
          .insert([{ 
            user_id: user.id,
            count: 1,
            date: today
          }])
          .select();
          
        // Update local data
        if (newScan && newScan[0]) {
          const username = currentUser?.username || 'Unknown';
          setDailyScans(prev => [
            ...prev, 
            { 
              date: today, 
              count: 1, 
              userId: user.id,
              username
            }
          ]);
        }
      }
    } catch (error: any) {
      console.error('Error updating daily scans:', error.message);
    }
  };
  
  const getUserDailyScans = (): number => {
    if (!user) return 0;
    const today = new Date().toISOString().split('T')[0];
    const todayScan = dailyScans.find(scan => scan.userId === user.id && scan.date === today);
    return todayScan?.count || 0;
  };
  
  const getUserTotalScans = (): number => {
    if (!user) return 0;
    return barcodes.filter(barcode => barcode.userId === user.id).length;
  };
  
  const getUserBarcodesScanned = (): Barcode[] => {
    if (!user) return [];
    return barcodes.filter(barcode => barcode.userId === user.id);
  };
  
  const getAllUserStats = (): UserStat[] => {
    if (!users || users.length === 0) {
      // Collect unique users from barcodes and daily scans
      const userIdsFromBarcodes = [...new Set(barcodes.map(b => b.userId))];
      const userIdsFromScans = [...new Set(dailyScans.map(ds => ds.userId))];
      const allUserIds = [...new Set([...userIdsFromBarcodes, ...userIdsFromScans])];
      
      // Create a map of usernames
      const usernameMap: {[key: string]: string} = {};
      
      // Add usernames from dailyScans
      dailyScans.forEach(scan => {
        if (scan.username && scan.userId) {
          usernameMap[scan.userId] = scan.username;
        }
      });
      
      // If currentUser exists and isn't in the map, add it
      if (currentUser && !usernameMap[currentUser.id]) {
        usernameMap[currentUser.id] = currentUser.username;
      }
      
      return allUserIds.map(userId => {
        const userScans = barcodes.filter(barcode => barcode.userId === userId);
        const userDailyScans = dailyScans.filter(scan => scan.userId === userId);
        
        // Calculate daily scans for today
        const today = new Date().toISOString().split('T')[0];
        const todayScan = userDailyScans.find(scan => scan.date === today);
        const dailyScanCount = todayScan?.count || 0;
        
        // Calculate days active
        const activeDays = new Set(userDailyScans.map(scan => scan.date)).size;
        
        // Calculate average scans per day
        const averageScans = activeDays > 0 
          ? userDailyScans.reduce((sum, scan) => sum + scan.count, 0) / activeDays 
          : 0;
        
        return {
          userId,
          username: usernameMap[userId] || `User-${userId.slice(0, 6)}`,
          totalScans: userScans.length,
          dailyScans: dailyScanCount,
          daysActive: activeDays,
          averageScansPerDay: Math.round(averageScans * 10) / 10 // Round to 1 decimal place
        };
      });
    }
    
    return users.map(user => {
      const userScans = barcodes.filter(barcode => barcode.userId === user.id);
      const userDailyScans = dailyScans.filter(scan => scan.userId === user.id);
      
      // Calculate daily scans for today
      const today = new Date().toISOString().split('T')[0];
      const todayScan = userDailyScans.find(scan => scan.date === today);
      const dailyScanCount = todayScan?.count || 0;
      
      // Calculate days active
      const activeDays = new Set(userDailyScans.map(scan => scan.date)).size;
      
      // Calculate average scans per day
      const averageScans = activeDays > 0 
        ? userDailyScans.reduce((sum, scan) => sum + scan.count, 0) / activeDays 
        : 0;
      
      return {
        userId: user.id,
        username: user.username,
        totalScans: userScans.length,
        dailyScans: dailyScanCount,
        daysActive: activeDays,
        averageScansPerDay: Math.round(averageScans * 10) / 10 // Round to 1 decimal place
      };
    });
  };
  
  // Get scans for a specific date
  const getDailyScans = async (date?: Date): Promise<DailyScanStat[]> => {
    const targetDate = date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    
    // First try to find data in our local state
    const localDailyScans = dailyScans.filter(scan => scan.date === targetDate);
    
    if (localDailyScans.length > 0) {
      return localDailyScans;
    }
    
    // If not found locally, query the database
    try {
      const { data, error } = await supabase
        .from('daily_scans')
        .select()
        .eq('date', targetDate);
        
      if (error) {
        console.error(`Error fetching daily scans for ${targetDate}:`, error);
        return [];
      }
      
      if (data && data.length > 0) {
        // Get usernames for these users
        const userIds = data.map(scan => scan.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds);
          
        const usernameMap = profiles ? 
          profiles.reduce((map: {[key: string]: string}, profile) => {
            map[profile.id] = profile.username;
            return map;
          }, {}) : {};
          
        return data.map(scan => ({
          date: scan.date,
          count: scan.count,
          userId: scan.user_id,
          username: usernameMap[scan.user_id] || 'Unknown'
        }));
      }
      
      return [];
    } catch (error: any) {
      console.error(`Error in getDailyScans for ${targetDate}:`, error.message);
      return [];
    }
  };
  
  // Get scans for a date range
  const getScansForDateRange = async (startDate: Date, endDate: Date): Promise<{date: string, count: number}[]> => {
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');
    
    try {
      const { data, error } = await supabase
        .from('daily_scans')
        .select('date, count')
        .gte('date', start)
        .lte('date', end);
        
      if (error) {
        console.error(`Error fetching scans for range ${start} to ${end}:`, error);
        return [];
      }
      
      if (data) {
        // Aggregate counts by date
        const countByDate: {[date: string]: number} = {};
        
        data.forEach(scan => {
          if (!countByDate[scan.date]) {
            countByDate[scan.date] = 0;
          }
          countByDate[scan.date] += scan.count;
        });
        
        // Convert to array for returning
        return Object.entries(countByDate).map(([date, count]) => ({ date, count }));
      }
      
      return [];
    } catch (error: any) {
      console.error(`Error in getScansForDateRange for ${start} to ${end}:`, error.message);
      return [];
    }
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
    addSubRow,
    
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

export const useDB = () => {
  const context = useContext(DBContext);
  if (!context) {
    throw new Error('useDB must be used within a DBProvider');
  }
  return context;
};
