/**
 * Hook to monitor network connectivity status
 * Provides real-time updates when the device goes online/offline
 */

import { useState, useEffect, useCallback } from 'react';
import { onlineManager } from '@tanstack/react-query';

interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;      // True if just came back online
  lastOnlineAt: Date | null;
  lastOfflineAt: Date | null;
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    wasOffline: false,
    lastOnlineAt: navigator.onLine ? new Date() : null,
    lastOfflineAt: navigator.onLine ? null : new Date(),
  });

  const handleOnline = useCallback(() => {
    console.log('[NetworkStatus] Device is online');
    
    // Sync with React Query's online manager
    onlineManager.setOnline(true);
    
    setStatus(prev => ({
      isOnline: true,
      wasOffline: !prev.isOnline, // Was offline before this
      lastOnlineAt: new Date(),
      lastOfflineAt: prev.lastOfflineAt,
    }));

    // Reset wasOffline after a short delay
    setTimeout(() => {
      setStatus(prev => ({
        ...prev,
        wasOffline: false,
      }));
    }, 5000);
  }, []);

  const handleOffline = useCallback(() => {
    console.log('[NetworkStatus] Device is offline');
    
    // Sync with React Query's online manager
    onlineManager.setOnline(false);
    
    setStatus(prev => ({
      isOnline: false,
      wasOffline: false,
      lastOnlineAt: prev.lastOnlineAt,
      lastOfflineAt: new Date(),
    }));
  }, []);

  useEffect(() => {
    // Set initial state
    onlineManager.setOnline(navigator.onLine);

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also listen to React Query's online manager changes
    const unsubscribe = onlineManager.subscribe((isOnline) => {
      if (isOnline !== status.isOnline) {
        setStatus(prev => ({
          ...prev,
          isOnline,
        }));
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, [handleOnline, handleOffline, status.isOnline]);

  return status;
}

/**
 * Simple hook that just returns whether we're online
 * Use this when you don't need the full status object
 */
export function useIsOnline(): boolean {
  const { isOnline } = useNetworkStatus();
  return isOnline;
}
