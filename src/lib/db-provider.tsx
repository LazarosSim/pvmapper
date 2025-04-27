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
  password: string;
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
  login: (username: string, password: string) => boolean;
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
          role: profile.role,
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
          const { data: parks } = await supabase
            .from('parks')
            .select('*');
          setParks(parks || []);
        }
      )
      .subscribe();

    const rowsSubscription = supabase
      .channel('public:rows')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rows' },
        async (payload) => {
          const { data: rows } = await supabase
            .from('rows')
            .select('*');
          setRows(rows || []);
        }
      )
      .subscribe();

    const barcodesSubscription = supabase
      .channel('public:barcodes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'barcodes' },
        async (payload) => {
          const { data: barcodes } = await supabase
            .from('barcodes')
            .select('*');
          setBarcodes(barcodes || []);
        }
      )
      .subscribe();

    async function loadData() {
      const [parksData, rowsData, barcodesData] = await Promise.all([
        supabase.from('parks').select('*'),
        supabase.from('rows').select('*'),
        supabase.from('barcodes').select('*')
      ]);

      if (parksData.data) setParks(parksData.data);
      if (rowsData.data) setRows(rowsData.data);
      if (barcodesData.data) setBarcodes(barcodesData.data);
    }

    loadData();

    return () => {
      parksSubscription.unsubscribe();
      rowsSubscription.unsubscribe();
      barcodesSubscription.unsubscribe();
    };
  }, [user]);

  const login = (username: string, password: string): boolean => {
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      setCurrentUser(user);
      toast.success(`Welcome back, ${username}!`);
      return true;
    } else {
      toast.error("Invalid username or password");
      return false;
    }
  };

  const logout = (): void => {
    setCurrentUser(null);
    toast.success("Logged out successfully");
  };

  const register = (username: string, password: string, role: 'user' | 'manager' = 'user'): boolean => {
    if (users.some(u => u.username === username)) {
      toast.error("Username already exists");
      return false;
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      username,
      password, 
      role,
      createdAt: new Date().toISOString()
    };
    
    setUsers(prev => [...prev, newUser]);
    setCurrentUser(newUser);
    toast.success("Registration successful");
    return true;
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
      const newPark: Park = {
        id: crypto.randomUUID(),
        name,
        expectedBarcodes,
        createdAt: new Date().toISOString()
      };

      setParks(prev => [...prev, newPark]);
      toast.success(`Created park: ${name}`);
      return newPark;
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
      const newBarcode: Barcode = {
        id: crypto.randomUUID(),
        code,
        rowId,
        userId: currentUser.id,
        timestamp: new Date().toISOString()
      };

      const rowBarcodes = barcodes.filter(barcode => barcode.rowId === rowId);
      
      setBarcodes(prev => {
        if (position !== undefined && position >= 0 && position < rowBarcodes.length) {
          const updatedBarcodes = [...prev];
          const rowBarcodeIndices = updatedBarcodes
            .map((barcode, index) => barcode.rowId === rowId ? index : -1)
            .filter(index => index !== -1);
          
          if (position >= 0 && position < rowBarcodeIndices.length) {
            const insertIndex = rowBarcodeIndices[position] + 1;
            updatedBarcodes.splice(insertIndex, 0, newBarcode);
            return updatedBarcodes;
          }
          
          return [...prev, newBarcode];
        }
        
        return [...prev, newBarcode];
      });

      const today = new Date().toISOString().split('T')[0];
      const existingDailyScan = dailyScans.find(scan => 
        scan.date === today && scan.userId === currentUser.id
      );
      
      if (existingDailyScan) {
        setDailyScans(prev => prev.map(scan => 
          scan.date === today && scan.userId === currentUser.id 
            ? { ...scan, count: scan.count + 1 } 
            : scan
        ));
      } else {
        setDailyScans(prev => [...prev, { 
          date: today, 
          userId: currentUser.id, 
          count: 1 
        }]);
      }
      
      toast.success(`Added barcode: ${code}`);
      return newBarcode;
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
      setParks(prev => 
        prev.map(park => 
          park.id === parkId 
            ? { 
                ...park, 
                name, 
                ...(expectedBarcodes !== undefined ? { expectedBarcodes } : {}) 
              } 
            : park
        )
      );
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
      const rowBarcodes = barcodes.filter(barcode => 
        barcode.rowId === rowId && barcode.userId === currentUser.id
      );
      
      if (rowBarcodes.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const todayScans = rowBarcodes.filter(barcode => 
          barcode.timestamp.startsWith(today)
        ).length;
        
        if (todayScans > 0) {
          setDailyScans(prev => prev.map(scan => 
            scan.date === today && scan.userId === currentUser.id
              ? { ...scan, count: Math.max(0, scan.count - todayScans) }
              : scan
          ));
        }
      }
      
      setBarcodes(prev => prev.filter(barcode => barcode.rowId !== rowId));
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

      const newRow: Row = {
        id: crypto.randomUUID(),
        name: rowName,
        parkId,
        createdAt: new Date().toISOString()
      };

      setRows(prev => [...prev, newRow]);
      toast.success(`Created row: ${rowName}`);
      return newRow;
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
      const parkRows = rows.filter(row => row.parkId === parkId);
      
      const rowIds = parkRows.map(row => row.id);
      const parkBarcodes = barcodes.filter(barcode => rowIds.includes(barcode.rowId));
      
      setBarcodes(prev => prev.filter(barcode => !parkBarcodes.some(pb => pb.id === barcode.id)));
      
      setRows(prev => prev.filter(row => row.parkId !== parkId));
      
      setParks(prev => prev.filter(park => park.id !== parkId));
      
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
      setBarcodes(prev => prev.filter(barcode => barcode.rowId !== rowId));
      
      setRows(prev => prev.filter(row => row.id !== rowId));
      
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
      setBarcodes(prev => prev.filter(barcode => barcode.id !== barcodeId));
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
      setRows(prev => 
        prev.map(row => 
          row.id === rowId ? { ...row, name } : row
        )
      );
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
      setBarcodes(prev => 
        prev.map(barcode => 
          barcode.id === barcodeId ? { ...barcode, code } : barcode
        )
      );
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
