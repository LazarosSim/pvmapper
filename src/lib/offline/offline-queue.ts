/**
 * IndexedDB-based offline queue for storing mutations
 * Ensures data persistence even if browser crashes or refreshes
 */

import { QueuedMutation, QueuedMutationPayload, MutationType } from './types';

const DB_NAME = 'pvmapper-offline';
const DB_VERSION = 1;
const STORE_NAME = 'mutations';
const SEQUENCE_STORE = 'sequences';

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
export async function initOfflineDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('[OfflineQueue] IndexedDB initialized');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create mutations store with indexes
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('rowId', 'payload.rowId', { unique: false });
        store.createIndex('timestamp', 'payload.timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        console.log('[OfflineQueue] Created mutations store');
      }

      // Create sequences store for tracking local sequence numbers per row
      if (!db.objectStoreNames.contains(SEQUENCE_STORE)) {
        db.createObjectStore(SEQUENCE_STORE, { keyPath: 'rowId' });
        console.log('[OfflineQueue] Created sequences store');
      }
    };
  });
}

/**
 * Get the database instance, initializing if needed
 */
async function getDB(): Promise<IDBDatabase> {
  if (!dbInstance) {
    return initOfflineDB();
  }
  return dbInstance;
}

/**
 * Generate a stable UUID for client-side identification
 */
export function generateClientId(): string {
  return crypto.randomUUID();
}

/**
 * Get the next local sequence number for a row
 * This ensures correct ordering even when offline
 */
export async function getNextLocalSequence(rowId: string): Promise<number> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SEQUENCE_STORE], 'readwrite');
    const store = transaction.objectStore(SEQUENCE_STORE);

    const getRequest = store.get(rowId);

    getRequest.onsuccess = () => {
      const current = getRequest.result?.sequence ?? 0;
      const next = current + 1;

      const putRequest = store.put({ rowId, sequence: next });

      putRequest.onsuccess = () => {
        resolve(next);
      };

      putRequest.onerror = () => {
        reject(putRequest.error);
      };
    };

    getRequest.onerror = () => {
      reject(getRequest.error);
    };
  });
}

/**
 * Add a mutation to the offline queue
 */
export async function addToQueue(
  type: MutationType,
  payload: QueuedMutationPayload
): Promise<QueuedMutation> {
  const db = await getDB();
  const id = generateClientId();

  const mutation: QueuedMutation = {
    id,
    type,
    payload,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.add(mutation);

    request.onsuccess = () => {
      console.log('[OfflineQueue] Added mutation:', mutation.id, type);
      resolve(mutation);
    };

    request.onerror = () => {
      console.error('[OfflineQueue] Failed to add mutation:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Get all pending mutations from the queue, sorted by timestamp and sequence
 */
export async function getQueue(): Promise<QueuedMutation[]> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.getAll();

    request.onsuccess = () => {
      const mutations = request.result as QueuedMutation[];

      // Sort by timestamp, then by localSequence for correct order
      const sorted = mutations.sort((a, b) => {
        const timeCompare = a.payload.timestamp.localeCompare(b.payload.timestamp);
        if (timeCompare !== 0) return timeCompare;
        return a.payload.localSequence - b.payload.localSequence;
      });

      resolve(sorted);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Get mutations for a specific row
 */
export async function getQueueByRow(rowId: string): Promise<QueuedMutation[]> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('rowId');

    const request = index.getAll(rowId);

    request.onsuccess = () => {
      const mutations = request.result as QueuedMutation[];

      // Sort by timestamp and sequence
      const sorted = mutations.sort((a, b) => {
        const timeCompare = a.payload.timestamp.localeCompare(b.payload.timestamp);
        if (timeCompare !== 0) return timeCompare;
        return a.payload.localSequence - b.payload.localSequence;
      });

      resolve(sorted);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Get the count of pending mutations
 */
export async function getQueueCount(): Promise<number> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.count();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Update the status of a mutation
 */
export async function updateMutationStatus(
  id: string,
  status: QueuedMutation['status']
): Promise<void> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const mutation = getRequest.result as QueuedMutation;
      if (mutation) {
        mutation.status = status;
        const putRequest = store.put(mutation);

        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => {
      reject(getRequest.error);
    };
  });
}

/**
 * Remove a single mutation from the queue
 */
export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.delete(id);

    request.onsuccess = () => {
      console.log('[OfflineQueue] Removed mutation:', id);
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Clear all mutations from the queue (after successful sync)
 */
export async function clearQueue(): Promise<void> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.clear();

    request.onsuccess = () => {
      console.log('[OfflineQueue] Queue cleared');
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Reset sequence counters (useful after sync to align with server)
 */
export async function resetSequences(): Promise<void> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SEQUENCE_STORE], 'readwrite');
    const store = transaction.objectStore(SEQUENCE_STORE);

    const request = store.clear();

    request.onsuccess = () => {
      console.log('[OfflineQueue] Sequences reset');
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Check if there are any pending mutations
 */
export async function hasPendingMutations(): Promise<boolean> {
  const count = await getQueueCount();
  return count > 0;
}

/**
 * Get mutations grouped by row ID
 */
export async function getQueueGroupedByRow(): Promise<Record<string, QueuedMutation[]>> {
  const queue = await getQueue();
  const grouped: Record<string, QueuedMutation[]> = {};

  for (const mutation of queue) {
    const rowId = mutation.payload.rowId;
    if (!grouped[rowId]) {
      grouped[rowId] = [];
    }
    grouped[rowId].push(mutation);
  }

  return grouped;
}
