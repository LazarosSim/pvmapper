/**
 * Offline Status Banner
 * Shows when user is offline
 */

import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { cn } from '@/lib/utils';

interface OfflineStatusBannerProps {
  className?: string;
}

export const OfflineStatusBanner = ({ className }: OfflineStatusBannerProps) => {
  const { isOnline } = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950',
        className
      )}
    >
      <WifiOff className="h-4 w-4" />
      <span>You're offline. Scans will be saved and synced when you reconnect.</span>
    </div>
  );
};
