/**
 * Barcode Queue Service
 * Handles queuing barcodes for offline-first operation
 */

import { addToQueue, getNextLocalSequence, getQueueByRow } from './offline-queue';
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
