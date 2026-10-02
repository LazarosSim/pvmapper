
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
  currentBarcodes?: number;
  archived?: boolean;
  archivedAt?: string | null;
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
  logout: () => Promise<void>;
  isManager: () => boolean;

  // Row actions that need the server
  addRow: (parkId: string, expectedBarcodes?: number, navigate?: boolean, customName?: string) => Promise<Row | null>;
  addSubRow: (rowId: string, expectedBarcodes?: number) => Promise<Row | null>;
  updateRow: (rowId: string, name: string, expectedBarcodes?: number) => Promise<void>;
  deleteRow: (rowId: string) => Promise<void>;
};
