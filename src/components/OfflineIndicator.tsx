/**
 * Offline Indicator Component
 * Shows network status, pending sync count, and manual sync button
 */

import { useNetworkStatus } from '@/hooks/use-network-status';
import { useSync } from '@/hooks/use-sync';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, RefreshCw, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const OfflineIndicator = () => {
    const { isOnline } = useNetworkStatus();
    const { pendingCount, isSyncing, canStartSync, startSync } = useSync();

    // Don't show if online and nothing pending
    if (isOnline && pendingCount === 0 && !isSyncing) {
        return null;
    }

    return (
        <div className="fixed bottom-20 right-4 z-40 flex items-center gap-2 bg-background border rounded-lg shadow-lg p-3">
            {/* Network Status Badge */}
            <Badge
                variant={isOnline ? 'default' : 'destructive'}
                className={cn(
                    'flex items-center gap-1.5',
                    isOnline && 'bg-green-500 hover:bg-green-600'
                )}
            >
                {isOnline ? (
                    <>
                        <Wifi className="h-3 w-3" />
                        <span>Online</span>
                    </>
                ) : (
                    <>
                        <WifiOff className="h-3 w-3" />
                        <span>Offline</span>
                    </>
                )}
            </Badge>

            {/* Pending Count */}
            {pendingCount > 0 && (
                <Badge variant="outline" className="flex items-center gap-1.5">
                    <span className="font-semibold">{pendingCount}</span>
                    <span className="text-xs">pending</span>
                </Badge>
            )}

            {/* Sync Button */}
            {isOnline && pendingCount > 0 && (
                <Button
                    size="sm"
                    onClick={startSync}
                    disabled={!canStartSync || isSyncing}
                    className="h-8"
                >
                    {isSyncing ? (
                        <>
                            <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />
                            Syncing...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="mr-1.5 h-3 w-3" />
                            Sync Now
                        </>
                    )}
                </Button>
            )}

            {/* Synced Indicator */}
            {isOnline && pendingCount === 0 && !isSyncing && (
                <div className="flex items-center gap-1.5 text-green-600 text-sm">
                    <CheckCircle className="h-4 w-4" />
                    <span>All synced</span>
                </div>
            )}
        </div>
    );
};
