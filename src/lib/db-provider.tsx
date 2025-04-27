import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabase } from "./supabase-provider";
import { toast } from "sonner";

export interface Barcode {
  id: string;
  code: string;
  timestamp: string;
  rowId: string;
  userId?: string;
}

export interface Row {
  id: string;
  name: string;
  parkId: string;
  createdAt: string;
}

export interface Park {
  id: string;
  name: string;
  createdAt: string;
  expectedBarcodes: number;
}

export interface User {
  id: string;
  username: string;
  role: 'user' | 'manager';
  createdAt: string;
}

export interface DailyScan {
  date: string;
  userId: string;
  count: number;
}

interface DBContextType {
  parks: Park[];
  rows: Row[];
  barcodes: Barcode[];
  users: User[];
  currentUser: User | null;
  addPark: (name: string, expectedBarcodes: number) => Promise<Park | null>;
  addRow: (parkId: string) => Promise<Row | null>;
  addBarcode: (code: string, rowId: string, position?: number) => Promise<Barcode | null>;
  deletePark: (parkId: string) => Promise<boolean>;
  deleteRow: (rowId: string) => Promise<boolean>;
  deleteBarcode: (barcodeId: string) => Promise<boolean>;
  updatePark: (parkId: string, name: string, expectedBarcodes?: number) => Promise<boolean>;
  updateRow: (rowId: string, name: string) => Promise<boolean>;
  updateBarcode: (barcodeId: string, code: string) => Promise<boolean>;
  getBarcodesByRowId: (rowId: string) => Barcode[];
  getRowsByParkId: (parkId: string) => Row[];
  getParkById: (parkId: string) => Park | undefined;
  getRowById: (rowId: string) => Row | undefined;
  getBarcodeById: (barcodeId: string) => Barcode | undefined;
  exportData: () => string;
  importData: (data: string) => boolean;
  searchBarcodes: (query: string) => Barcode[];
  countBarcodesInRow: (rowId: string) => number;
  countBarcodesInPark: (parkId: string) => number;
  resetRow: (rowId: string) => Promise<boolean>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (username: string, password: string, role?: 'user' | 'manager') => boolean;
  getUserDailyScans: (userId?: string) => number;
  getUserTotalScans: (userId?: string) => number;
  getUserBarcodesScanned: (userId?: string) => Barcode[];
  getAllUserStats: () => Array<{ userId: string, username: string, dailyScans: number, totalScans: number }>;
  getParkProgress: (parkId: string) => { completed: number, total: number, percentage: number };
}

const DBContext = createContext<DBContextType | undefined>(undefined);

export const useDB = () => {
  const context = useContext(DBContext);
  if (context === undefined) {
    throw new Error("useDB must be used within a DBProvider");
  }
  return context;
};

export const DBProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useSupabase();
  const [parks, setParks] = useState<Park[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [barcodes, setBarcodes] = useState<Barcode[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [dailyScans, setDailyScans] = useState<DailyScan[]>([]);

  useEffect(() => {
    async function loadUserProfile() {
      if (!user) {
        setCurrentUser(null);
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading user profile:', error);
        return;
      }

      if (profile) {
        setCurrentUser({
          id: profile.id,
          username: profile.username,
          role: profile.role as 'user' | 'manager',
          createdAt: profile.created_at
        });
      }
    }

    loadUserProfile();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const parksSubscription = supabase
      .channel('public:parks')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'parks' },
        async (payload) => {
          const { data: parksData } = await supabase
            .from('parks')
            .select('*');
          
          if (parksData) {
            const mappedParks = parksData.map(park => ({
              id: park.id,
              name: park.name,
              expectedBarcodes: park.expected_barcodes || 0,
              createdAt: park.created_at
            }));
            setParks(mappedParks);
          }
        }
      )
      .subscribe();

    const rowsSubscription = supabase
      .channel('public:rows')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rows' },
        async (payload) => {
          const { data: rowsData } = await supabase
            .from('rows')
            .select('*');
          
          if (rowsData) {
            const mappedRows = rowsData.map(row => ({
              id: row.id,
              name: row.name,
              parkId: row.park_id,
              createdAt: row.created_at
            }));
            setRows(mappedRows);
          }
        }
      )
      .subscribe();

    const barcodesSubscription = supabase
      .channel('public:barcodes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'barcodes' },
        async (payload) => {
          const { data: barcodesData } = await supabase
            .from('barcodes')
            .select('*');
          
          if (barcodesData) {
            const mappedBarcodes = barcodesData.map(barcode => ({
              id: barcode.id,
              code: barcode.code,
              timestamp: barcode.timestamp,
              rowId: barcode.row_id,
              userId: barcode.user_id
            }));
            setBarcodes(mappedBarcodes);
          }
        }
      )
      .subscribe();

    async function loadData() {
      const [parksData, rowsData, barcodesData] = await Promise.all([
        supabase.from('parks').select('*'),
        supabase.from('rows').select('*'),
        supabase.from('barcodes').select('*')
      ]);

      if (parksData.data) {
        const mappedParks = parksData.data.map(park => ({
          id: park.id,
          name: park.name,
          expectedBarcodes: park.expected_barcodes || 0,
          createdAt: park.created_at
        }));
        setParks(mappedParks);
      }

      if (rowsData.data) {
        const mappedRows = rowsData.data.map(row => ({
          id: row.id,
          name: row.name,
          parkId: row.park_id,
          createdAt: row.created_at
        }));
        setRows(mappedRows);
      }

      if (barcodesData.data) {
        const mappedBarcodes = barcodesData.data.map(barcode => ({
          id: barcode.id,
          code: barcode.code,
          timestamp: barcode.timestamp,
          rowId: barcode.row_id,
          userId: barcode.user_id
        }));
        setBarcodes(mappedBarcodes);
      }
    }

    loadData();

    return () => {
      parksSubscription.unsubscribe();
      rowsSubscription.unsubscribe();
      barcodesSubscription.unsubscribe();
    };
  }, [user]);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const email = `${username.toLowerCase()}@example.com`;
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        return false;
      }

      toast.success(`Welcome back, ${username}!`);
      return true;
    } catch (error: any) {
      toast.error("Login failed: " + error.message);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        toast.error(error.message);
        return;
      }
      
      toast.success("Logged out successfully");
    } catch (error: any) {
      toast.error("Logout failed: " + error.message);
    }
  };
  
  const register = async (username: string, password: string, role: 'user' | 'manager' = 'user'): Promise<boolean> => {
    try {
      const email = `${username.toLowerCase()}@example.com`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            role
          }
        }
      });
      
      if (error) {
        toast.error(error.message);
        return false;
      }
      
      toast.success("Registration successful");
      return true;
    } catch (error: any) {
      toast.error("Registration failed: " + error.message);
      return false;
    }
  };

  const addPark = async (name: string, expectedBarcodes: number = 0): Promise<Park | null> => {
    if (!currentUser || (currentUser.role !== 'manager')) {
      toast.error("Only managers can create parks");
      return null;
    }

    if (parks.some(park => park.name.toLowerCase() === name.toLowerCase())) {
      toast.error("A park with this name already exists");
      return null;
    }

    try {
      const { data: newPark, error } = await supabase
        .from('parks')
        .insert({
          name,
          expected_barcodes: expectedBarcodes,
          user_id: user?.id
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to add park:", error);
        toast.error("Failed to create park");
        return null;
      }

      const mappedPark: Park = {
        id: newPark.id,
        name: newPark.name,
        expectedBarcodes: newPark.expected_barcodes || 0,
        createdAt: newPark.created_at
      };

      toast.success(`Created park: ${name}`);
      return mappedPark;
    } catch (error) {
      console.error("Failed to add park:", error);
      toast.error("Failed to create park");
      return null;
    }
  };

  const addBarcode = async (code: string, rowId: string, position?: number): Promise<Barcode | null> => {
    if (!currentUser) {
      toast.error("You must be logged in to add barcodes");
      return null;
    }

    if (barcodes.some(barcode => barcode.code === code)) {
      toast.error("This barcode already exists");
      return null;
    }

    try {
      const { data: newBarcode, error } = await supabase
        .from('barcodes')
        .insert({
          code,
          row_id: rowId,
          user_id: user?.id
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to add barcode:", error);
        toast.error("Failed to add barcode");
        return null;
      }

      const today = new Date().toISOString().split('T')[0];
      
      const { data: existingScan } = await supabase
        .from('daily_scans')
        .select()
        .eq('user_id', user?.id)
        .eq('date', today)
        .single();

      if (existingScan) {
        await supabase
          .from('daily_scans')
          .update({ count: existingScan.count + 1 })
          .eq('id', existingScan.id);
      } else {
        await supabase
          .from('daily_scans')
          .insert({
            user_id: user?.id,
            count: 1,
            date: today
          });
      }

      const mappedBarcode: Barcode = {
        id: newBarcode.id,
        code: newBarcode.code,
        timestamp: newBarcode.timestamp,
        rowId: newBarcode.row_id,
        userId: newBarcode.user_id
      };

      toast.success(`Added barcode: ${code}`);
      return mappedBarcode;
    } catch (error) {
      console.error("Failed to add barcode:", error);
      toast.error("Failed to add barcode");
      return null;
    }
  };

  const updatePark = async (parkId: string, name: string, expectedBarcodes?: number): Promise<boolean> => {
    if (!currentUser || (currentUser.role !== 'manager')) {
      toast.error("Only managers can update parks");
      return false;
    }

    if (parks.some(park => park.id !== parkId && park.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Another park with this name already exists");
      return false;
    }

    try {
      const updateData: any = { name };
      if (expectedBarcodes !== undefined) {
        updateData.expected_barcodes = expectedBarcodes;
      }

      const { error } = await supabase
        .from('parks')
        .update(updateData)
        .eq('id', parkId);

      if (error) {
        console.error("Failed to update park:", error);
        toast.error("Failed to update park");
        return false;
      }

      toast.success("Park updated");
      return true;
    } catch (error) {
      console.error("Failed to update park:", error);
      toast.error("Failed to update park");
      return false;
    }
  };

  const resetRow = async (rowId: string): Promise<boolean> => {
    if (!currentUser) {
      toast.error("You must be logged in to reset rows");
      return false;
    }

    try {
      const { error } = await supabase
        .from('barcodes')
        .delete()
        .eq('row_id', rowId);

      if (error) {
        console.error("Failed to reset row:", error);
        toast.error("Failed to reset row");
        return false;
      }

      toast.success("Row data has been reset");
      return true;
    } catch (error) {
      console.error("Failed to reset row:", error);
      toast.error("Failed to reset row");
      return false;
    }
  };

  const getUserDailyScans = (userId?: string): number => {
    const today = new Date().toISOString().split('T')[0];
    const userToCheck = userId || (currentUser?.id);
    
    if (!userToCheck) return 0;
    
    const todayScan = dailyScans.find(scan => 
      scan.date === today && scan.userId === userToCheck);
    
    return todayScan?.count || 0;
  };

  const getUserTotalScans = (userId?: string): number => {
    const userToCheck = userId || (currentUser?.id);
    
    if (!userToCheck) return 0;
    
    return barcodes.filter(barcode => barcode.userId === userToCheck).length;
  };

  const getUserBarcodesScanned = (userId?: string): Barcode[] => {
    const userToCheck = userId || (currentUser?.id);
    
    if (!userToCheck) return [];
    
    return barcodes
      .filter(barcode => barcode.userId === userToCheck)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const getAllUserStats = () => {
    if (!currentUser || currentUser.role !== 'manager') {
      return [];
    }

    return users.map(user => ({
      userId: user.id,
      username: user.username,
      dailyScans: getUserDailyScans(user.id),
      totalScans: getUserTotalScans(user.id)
    }));
  };

  const getParkProgress = (parkId: string) => {
    const park = parks.find(p => p.id === parkId);
    if (!park) return { completed: 0, total: 0, percentage: 0 };

    const total = park.expectedBarcodes;
    const parkRowIds = rows.filter(row => row.parkId === parkId).map(row => row.id);
    const completed = barcodes.filter(barcode => parkRowIds.includes(barcode.rowId)).length;
    
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  };

  const addRow = async (parkId: string): Promise<Row | null> => {
    try {
      const park = parks.find(p => p.id === parkId);
      if (!park) {
        toast.error("Park not found");
        return null;
      }

      const parkRows = rows.filter(row => row.parkId === parkId);
      const highestNumber = parkRows.reduce((max, row) => {
        const match = row.name.match(/Row (\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          return num > max ? num : max;
        }
        return max;
      }, 0);
      
      const rowNumber = highestNumber + 1;
      const rowName = `Row ${rowNumber}`;

      const { data: newRow, error } = await supabase
        .from('rows')
        .insert({
          name: rowName,
          park_id: parkId
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to add row:", error);
        toast.error("Failed to create row");
        return null;
      }

      const mappedRow: Row = {
        id: newRow.id,
        name: newRow.name,
        parkId: newRow.park_id,
        createdAt: newRow.created_at
      };

      toast.success(`Created row: ${rowName}`);
      return mappedRow;
    } catch (error) {
      console.error("Failed to add row:", error);
      toast.error("Failed to create row");
      return null;
    }
  };

  const deletePark = async (parkId: string): Promise<boolean> => {
    if (!currentUser || currentUser.role !== 'manager') {
      toast.error("Only managers can delete parks");
      return false;
    }

    try {
      const { error } = await supabase
        .from('parks')
        .delete()
        .eq('id', parkId);

      if (error) {
        console.error("Failed to delete park:", error);
        toast.error("Failed to delete park");
        return false;
      }
      
      toast.success("Park deleted");
      return true;
    } catch (error) {
      console.error("Failed to delete park:", error);
      toast.error("Failed to delete park");
      return false;
    }
  };

  const deleteRow = async (rowId: string): Promise<boolean> => {
    if (!currentUser) {
      toast.error("You must be logged in to delete rows");
      return false;
    }

    try {
      const { error } = await supabase
        .from('rows')
        .delete()
        .eq('id', rowId);

      if (error) {
        console.error("Failed to delete row:", error);
        toast.error("Failed to delete row");
        return false;
      }
      
      toast.success("Row deleted");
      return true;
    } catch (error) {
      console.error("Failed to delete row:", error);
      toast.error("Failed to delete row");
      return false;
    }
  };

  const deleteBarcode = async (barcodeId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('barcodes')
        .delete()
        .eq('id', barcodeId);

      if (error) {
        console.error("Failed to delete barcode:", error);
        toast.error("Failed to delete barcode");
        return false;
      }

      toast.success("Barcode deleted");
      return true;
    } catch (error) {
      console.error("Failed to delete barcode:", error);
      toast.error("Failed to delete barcode");
      return false;
    }
  };

  const updateRow = async (rowId: string, name: string): Promise<boolean> => {
    if (!currentUser) {
      toast.error("You must be logged in to update rows");
      return false;
    }

    try {
      const { error } = await supabase
        .from('rows')
        .update({ name })
        .eq('id', rowId);

      if (error) {
        console.error("Failed to update row:", error);
        toast.error("Failed to update row");
        return false;
      }

      toast.success("Row updated");
      return true;
    } catch (error) {
      console.error("Failed to update row:", error);
      toast.error("Failed to update row");
      return false;
    }
  };

  const updateBarcode = async (barcodeId: string, code: string): Promise<boolean> => {
    if (barcodes.some(barcode => barcode.id !== barcodeId && barcode.code === code)) {
      toast.error("Another barcode with this code already exists");
      return false;
    }

    try {
      const { error } = await supabase
        .from('barcodes')
        .update({ code })
        .eq('id', barcodeId);

      if (error) {
        console.error("Failed to update barcode:", error);
        toast.error("Failed to update barcode");
        return false;
      }

      toast.success("Barcode updated");
      return true;
    } catch (error) {
      console.error("Failed to update barcode:", error);
      toast.error("Failed to update barcode");
      return false;
    }
  };

  const getBarcodesByRowId = (rowId: string): Barcode[] => {
    return barcodes.filter(barcode => barcode.rowId === rowId);
  };

  const getRowsByParkId = (parkId: string): Row[] => {
    return rows.filter(row => row.parkId === parkId);
  };

  const getParkById = (parkId: string): Park | undefined => {
    return parks.find(park => park.id === parkId);
  };

  const getRowById = (rowId: string): Row | undefined => {
    return rows.find(row => row.id === rowId);
  };

  const getBarcodeById = (barcodeId: string): Barcode | undefined => {
    return barcodes.find(barcode => barcode.id === barcodeId);
  };

  const countBarcodesInRow = (rowId: string): number => {
    return barcodes.filter(barcode => barcode.rowId === rowId).length;
  };

  const countBarcodesInPark = (parkId: string): number => {
    const parkRowIds = rows.filter(row => row.parkId === parkId).map(row => row.id);
    return barcodes.filter(barcode => parkRowIds.includes(barcode.rowId)).length;
  };

  const exportData = (): string => {
    try {
      const data = {
        parks,
        rows,
        barcodes,
        users: users.map(user => ({ ...user, password: '******' })),
        dailyScans,
        exportDate: new Date().toISOString()
      };
      
      return JSON.stringify(data);
    } catch (error) {
      console.error("Failed to export data:", error);
      toast.error("Failed to export data");
      return "";
    }
  };

  const importData = (data: string): boolean => {
    try {
      const parsedData = JSON.parse(data);
      
      if (!parsedData.parks || !parsedData.rows || !parsedData.barcodes) {
        toast.error("Invalid data format");
        return false;
      }
      
      setParks(parsedData.parks);
      setRows(parsedData.rows);
      setBarcodes(parsedData.barcodes);
      
      if (parsedData.users) {
        const mergedUsers = parsedData.users.map((importedUser: any) => {
          const existingUser = users.find(u => u.id === importedUser.id);
          return existingUser ? { ...importedUser, password: existingUser.password } : importedUser;
        });
        setUsers(mergedUsers);
      }
      
      if (parsedData.dailyScans) {
        setDailyScans(parsedData.dailyScans);
      }
      
      toast.success("Data imported successfully");
      return true;
    } catch (error) {
      console.error("Failed to import data:", error);
      toast.error("Failed to import data");
      return false;
    }
  };

  const searchBarcodes = (query: string): Barcode[] => {
    if (!query) return [];
    
    const lowerQuery = query.toLowerCase();
    return barcodes.filter(barcode => 
      barcode.code.toLowerCase().includes(lowerQuery)
    );
  };

  const value = {
    parks,
    rows,
    barcodes,
    users,
    currentUser,
    addPark,
    addRow,
    addBarcode,
    deletePark,
    deleteRow,
    deleteBarcode,
    updatePark,
    updateRow,
    updateBarcode,
    getBarcodesByRowId,
    getRowsByParkId,
    getParkById,
    getRowById,
    getBarcodeById,
    exportData,
    importData,
    searchBarcodes,
    countBarcodesInRow,
    countBarcodesInPark,
    resetRow,
    login,
    logout,
    register,
    getUserDailyScans,
    getUserTotalScans,
    getUserBarcodesScanned,
    getAllUserStats,
    getParkProgress
  };

  return <DBContext.Provider value={value}>{children}</DBContext.Provider>;
};
