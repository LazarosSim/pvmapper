
import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";

export interface Barcode {
  id: string;
  code: string;
  timestamp: string;
  rowId: string;
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
}

interface DBContextType {
  parks: Park[];
  rows: Row[];
  barcodes: Barcode[];
  addPark: (name: string) => Promise<Park | null>;
  addRow: (parkId: string) => Promise<Row | null>;
  addBarcode: (code: string, rowId: string) => Promise<Barcode | null>;
  deletePark: (parkId: string) => Promise<boolean>;
  deleteRow: (rowId: string) => Promise<boolean>;
  deleteBarcode: (barcodeId: string) => Promise<boolean>;
  updatePark: (parkId: string, name: string) => Promise<boolean>;
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
  const [parks, setParks] = useState<Park[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [barcodes, setBarcodes] = useState<Barcode[]>([]);

  // Load data from localStorage on initial render
  useEffect(() => {
    try {
      const savedParks = localStorage.getItem("parks");
      const savedRows = localStorage.getItem("rows");
      const savedBarcodes = localStorage.getItem("barcodes");

      if (savedParks) setParks(JSON.parse(savedParks));
      if (savedRows) setRows(JSON.parse(savedRows));
      if (savedBarcodes) setBarcodes(JSON.parse(savedBarcodes));
    } catch (error) {
      console.error("Failed to load data from localStorage:", error);
      toast.error("Failed to load saved data");
    }
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("parks", JSON.stringify(parks));
  }, [parks]);

  useEffect(() => {
    localStorage.setItem("rows", JSON.stringify(rows));
  }, [rows]);

  useEffect(() => {
    localStorage.setItem("barcodes", JSON.stringify(barcodes));
  }, [barcodes]);

  const addPark = async (name: string): Promise<Park | null> => {
    // Check if park with same name exists
    if (parks.some(park => park.name.toLowerCase() === name.toLowerCase())) {
      toast.error("A park with this name already exists");
      return null;
    }

    try {
      const newPark: Park = {
        id: crypto.randomUUID(),
        name,
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

  const addRow = async (parkId: string): Promise<Row | null> => {
    try {
      // Get park
      const park = parks.find(p => p.id === parkId);
      if (!park) {
        toast.error("Park not found");
        return null;
      }

      // Count existing rows in this park to name the new one
      const parkRows = rows.filter(row => row.parkId === parkId);
      const rowNumber = parkRows.length + 1;
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

  const addBarcode = async (code: string, rowId: string): Promise<Barcode | null> => {
    // Check if barcode with same code exists
    if (barcodes.some(barcode => barcode.code === code)) {
      toast.error("This barcode already exists");
      return null;
    }

    try {
      const newBarcode: Barcode = {
        id: crypto.randomUUID(),
        code,
        rowId,
        timestamp: new Date().toISOString()
      };

      setBarcodes(prev => [...prev, newBarcode]);
      toast.success(`Added barcode: ${code}`);
      return newBarcode;
    } catch (error) {
      console.error("Failed to add barcode:", error);
      toast.error("Failed to add barcode");
      return null;
    }
  };

  const deletePark = async (parkId: string): Promise<boolean> => {
    try {
      // Get all rows in this park
      const parkRows = rows.filter(row => row.parkId === parkId);
      
      // Get all barcodes in these rows
      const rowIds = parkRows.map(row => row.id);
      const parkBarcodes = barcodes.filter(barcode => rowIds.includes(barcode.rowId));
      
      // Delete all associated barcodes
      setBarcodes(prev => prev.filter(barcode => !parkBarcodes.some(pb => pb.id === barcode.id)));
      
      // Delete all associated rows
      setRows(prev => prev.filter(row => row.parkId !== parkId));
      
      // Delete the park
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
    try {
      // Delete all barcodes in this row
      setBarcodes(prev => prev.filter(barcode => barcode.rowId !== rowId));
      
      // Delete the row
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

  const updatePark = async (parkId: string, name: string): Promise<boolean> => {
    // Check if another park with same name exists
    if (parks.some(park => park.id !== parkId && park.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Another park with this name already exists");
      return false;
    }

    try {
      setParks(prev => 
        prev.map(park => 
          park.id === parkId ? { ...park, name } : park
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

  const updateRow = async (rowId: string, name: string): Promise<boolean> => {
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
    // Check if another barcode with same code exists
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
    countBarcodesInPark
  };

  return <DBContext.Provider value={value}>{children}</DBContext.Provider>;
};
