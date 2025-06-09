
// Type definitions for the database provider

// User type
export type User = {
  id: string;
  username: string;
  role: string;
  createdAt: string;
};

// Park type
export type Park = {
  id: string;
  name: string;
  expectedBarcodes: number;
  createdAt: string;
  userId: string;
  validateBarcodeLength?: boolean;
};

// Row type
export type Row = {
  id: string;
  name: string;
  parkId: string;
  createdAt: string;
  expectedBarcodes?: number | null;
  currentBarcodes: number;
};

// Barcode type
export type Barcode = {
  id: string;
  code: string;
  rowId: string;
  userId: string;
  timestamp: string;
  orderInRow: number;
  latitude?: number;
  longitude?: number;
};

// Progress type for tracking completion
export type Progress = {
  completed: number;
  total: number;
  percentage: number;
};

// Daily scan statistics
export type DailyScanStat = {
  date: string;
  count: number;
  userId: string;
  username?: string;
}

// User statistics
export type UserStat = {
  userId: string;
  username: string;
  totalScans: number;
  dailyScans: number;
  daysActive: number;
  averageScansPerDay: number;
};

// Database context type definition
export type DBContextType = {
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
  addRow: (parkId: string, expectedBarcodes?: number, navigate?: boolean, customName?: string) => Promise<Row | null>;
  deleteRow: (rowId: string) => Promise<void>;
  updateRow: (rowId: string, name: string, expectedBarcodes?: number) => Promise<void>;
  getRowById: (rowId: string) => Row | undefined;
  resetRow: (rowId: string) => Promise<boolean | void>;
  countBarcodesInRow: (rowId: string) => number;
  addSubRow: (rowId: string, expectedBarcodes?: number) => Promise<Row | null>;
  
  // Barcodes
  barcodes: Barcode[];
  deleteBarcode: (barcodeId: string) => Promise<void>;
  updateBarcode: (barcodeId: string, code: string) => Promise<void>;
  searchBarcodes: (query: string) => Barcode[];
  countBarcodesInPark: (parkId: string) => number;
  
  // User management
  users: User[];
  logout: () => Promise<void>;
  
  // User stats
  getScansForDateRange: (startDate: Date, endDate: Date) => Promise<{date: string, count: number}[]>;
  
  // Data management
  importData: (jsonData: string) => boolean;
  exportData: () => string;

  // Helper function
  isManager: () => boolean;
};
