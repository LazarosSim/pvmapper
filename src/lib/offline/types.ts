/**
 * Types for the offline queue system
 */

export type MutationType = 'ADD_BARCODE' | 'DELETE_BARCODE' | 'UPDATE_BARCODE';

export interface QueuedMutationPayload {
  code: string;
  rowId: string;
  orderInRow: number;
  timestamp: string;           // ISO string, client-generated
  localSequence: number;       // Per-row sequence for ordering
  userId?: string;
  latitude?: number;
  longitude?: number;
}

export interface QueuedMutation {
  id: string;                  // Stable UUID generated client-side
  type: MutationType;
  payload: QueuedMutationPayload;
  createdAt: string;           // When queued
  status: 'pending' | 'syncing' | 'failed';
}

export interface SyncState {
  isSyncing: boolean;
  progress: number;
  total: number;
  error: string | null;
}

export interface OfflineBarcode {
  id: string;
  code: string;
  rowId: string;
  orderInRow: number;
  timestamp: string;
  isPending: true;
  localSequence: number;
  latitude?: number;
  longitude?: number;
}
