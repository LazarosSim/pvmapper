/**
 * Floating Sync Button
 * Shows pending count badge and triggers sync
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CloudUpload, Loader2, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useSync } from '@/hooks/use-sync';
import { SyncProgressDialog } from './SyncProgressDialog';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { cn } from '@/lib/utils';

interface SyncButtonProps {
  className?: string;
}

export const SyncButton = ({ className }: SyncButtonProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { syncState, pendingCount, isSyncing, startSync } = useSync();
  const { isOnline } = useNetworkStatus();

  const handleClick = async () => {
    if (isSyncing) {
      // Just open dialog to show progress
      setDialogOpen(true);
      return;
    }

    if (pendingCount === 0) {
      return;
    }

    if (!isOnline) {
      return;
    }

    // Open dialog and start sync
    setDialogOpen(true);
    await startSync();
  };

  // Don't show if nothing pending
  if (pendingCount === 0) {
    return null;
  }

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={!isOnline || isSyncing}
        size="lg"
        className={cn(
          'fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full shadow-lg',
          'flex items-center justify-center p-0',
          !isOnline && 'bg-muted text-muted-foreground',
          className
        )}
      >
        {isSyncing ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : !isOnline ? (
          <WifiOff className="h-6 w-6" />
        ) : (
          <CloudUpload className="h-6 w-6" />
        )}
        
        {/* Badge for pending count */}
        {pendingCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -right-1 -top-1 h-6 min-w-6 rounded-full px-1.5 text-xs font-bold"
          >
            {pendingCount > 99 ? '99+' : pendingCount}
          </Badge>
        )}
      </Button>

      <SyncProgressDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        syncState={syncState}
      />
    </>
  );
};
