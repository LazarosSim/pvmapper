/**
 * Barcode Queue Service
 * Handles queuing barcodes for offline-first operation
 */

import { addToQueue, getNextLocalSequence, getQueueByRow, getQueue } from './offline-queue';
import type { QueuedMutation, OfflineBarcode, QueuedMutationPayload } from './types';

/**
 * Queue a barcode scan for later sync
 */
export const queueBarcodeScan = async (
  code: string,
  rowId: string,
  orderInRow: number,
  userId?: string,
  timestamp?: string,
  latitude?: number,
  longitude?: number
): Promise<QueuedMutation> => {
  const localSequence = await getNextLocalSequence(rowId);
  const now = timestamp || new Date().toISOString();

  const payload: QueuedMutationPayload = {
    code,
    rowId,
    orderInRow,
    timestamp: now,
    localSequence,
    userId,
    latitude,
    longitude,
  };

  const mutation = await addToQueue('ADD_BARCODE', payload);
  return mutation;
};

/**
 * Queue a barcode deletion for later sync
 */
export const queueBarcodeDelete = async (
  barcodeId: string,
  rowId: string,
  code: string,
  timestamp: string,
  userId?: string
): Promise<QueuedMutation> => {
  const localSequence = await getNextLocalSequence(rowId);

  const payload: QueuedMutationPayload = {
    code,
    rowId,
    orderInRow: 0, // Not relevant for delete
    timestamp,
    localSequence,
    userId,
    barcodeId,
  };

  const mutation = await addToQueue('DELETE_BARCODE', payload);
  return mutation;
};

/**
 * Queue a barcode update for later sync
 */
export const queueBarcodeUpdate = async (
  barcodeId: string,
  rowId: string,
  oldCode: string,
  newCode: string,
  timestamp: string,
  userId?: string
): Promise<QueuedMutation> => {
  const localSequence = await getNextLocalSequence(rowId);

  const payload: QueuedMutationPayload = {
    code: oldCode,
    rowId,
    orderInRow: 0, // Not relevant for update
    timestamp,
    localSequence,
    userId,
    barcodeId,
    newCode,
  };

  const mutation = await addToQueue('UPDATE_BARCODE', payload);
  return mutation;
};

/**
 * Get pending barcodes for a row as OfflineBarcode objects
 */
export const getPendingBarcodesForRow = async (rowId: string): Promise<OfflineBarcode[]> => {
  const mutations = await getQueueByRow(rowId);
  
  return mutations
    .filter(m => m.type === 'ADD_BARCODE' && m.status === 'pending')
    .map(m => ({
      id: m.id,
      code: m.payload.code,
      rowId: m.payload.rowId,
      orderInRow: m.payload.orderInRow,
      timestamp: m.payload.timestamp,
      isPending: true as const,
      localSequence: m.payload.localSequence,
      latitude: m.payload.latitude,
      longitude: m.payload.longitude,
    }));
};

/**
 * Get IDs of barcodes pending deletion for a row
 */
export const getPendingDeleteIds = async (rowId: string): Promise<Set<string>> => {
  const mutations = await getQueueByRow(rowId);
  
  const deleteIds = mutations
    .filter(m => m.type === 'DELETE_BARCODE' && m.status === 'pending')
    .map(m => m.payload.barcodeId)
    .filter((id): id is string => id !== undefined);

  return new Set(deleteIds);
};

/**
 * Get pending updates for a row (barcodeId -> newCode)
 */
export const getPendingUpdates = async (rowId: string): Promise<Map<string, string>> => {
  const mutations = await getQueueByRow(rowId);
  
  const updates = new Map<string, string>();
  
  mutations
    .filter(m => m.type === 'UPDATE_BARCODE' && m.status === 'pending')
    .forEach(m => {
      if (m.payload.barcodeId && m.payload.newCode) {
        updates.set(m.payload.barcodeId, m.payload.newCode);
      }
    });

  return updates;
};

/**
 * Get all pending mutations (for all rows)
 */
export const getAllPendingMutations = async (): Promise<{
  adds: OfflineBarcode[];
  deleteIds: Set<string>;
  updates: Map<string, string>;
}> => {
  const mutations = await getQueue();
  
  const adds: OfflineBarcode[] = mutations
    .filter(m => m.type === 'ADD_BARCODE' && m.status === 'pending')
    .map(m => ({
      id: m.id,
      code: m.payload.code,
      rowId: m.payload.rowId,
      orderInRow: m.payload.orderInRow,
      timestamp: m.payload.timestamp,
      isPending: true as const,
      localSequence: m.payload.localSequence,
      latitude: m.payload.latitude,
      longitude: m.payload.longitude,
    }));

  const deleteIds = new Set(
    mutations
      .filter(m => m.type === 'DELETE_BARCODE' && m.status === 'pending')
      .map(m => m.payload.barcodeId)
      .filter((id): id is string => id !== undefined)
  );

  const updates = new Map<string, string>();
  mutations
    .filter(m => m.type === 'UPDATE_BARCODE' && m.status === 'pending')
    .forEach(m => {
      if (m.payload.barcodeId && m.payload.newCode) {
        updates.set(m.payload.barcodeId, m.payload.newCode);
      }
    });

  return { adds, deleteIds, updates };
};
