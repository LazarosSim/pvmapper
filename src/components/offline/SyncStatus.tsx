/**
 * One status chip for the header: offline, syncing, waiting uploads, problems or all synced.
 * Tapping it shows details, a "Sync now" button and any changes the server refused.
 */
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CheckCircle2, CloudUpload, Loader2, RefreshCw, Trash2, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSyncSummary } from '@/lib/local/hooks';
import { syncNow } from '@/lib/local/sync';
import { discardFailed, retryFailed } from '@/lib/local/repo';
import type { OutboxEntry } from '@/lib/local/db';

const describe = (entry: OutboxEntry) => {
  switch (entry.op.type) {
    case 'add':
    case 'insertAt':
      return `Scan ${entry.op.barcode.code}`;
    case 'update':
      return `Edit to ${entry.op.code}`;
    case 'delete':
      return 'Delete barcode';
    case 'resetRow':
      return 'Reset row';
  }
};

export const SyncStatus = () => {
  const [open, setOpen] = useState(false);
  const { online, syncing, pendingCount, failed, lastSyncedAt, lastError } = useSyncSummary();

  const sync = () =>
    syncNow()
      .then(() => toast.success('All changes synced'))
      .catch((error) => toast.error(`Sync failed: ${error.message}`));

  let icon = <CheckCircle2 className="h-4 w-4" />;
  let label = 'Synced';
  if (failed.length > 0) {
    icon = <AlertTriangle className="h-4 w-4" />;
    label = `${failed.length} problem${failed.length > 1 ? 's' : ''}`;
  } else if (!online) {
    icon = <WifiOff className="h-4 w-4" />;
    label = pendingCount > 0 ? `Offline · ${pendingCount} waiting` : 'Offline';
  } else if (syncing) {
    icon = <Loader2 className="h-4 w-4 animate-spin" />;
    label = 'Syncing';
  } else if (pendingCount > 0) {
    icon = <CloudUpload className="h-4 w-4" />;
    label = `${pendingCount} waiting`;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/30"
        aria-label={`Sync status: ${label}`}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
        {(pendingCount > 0 || failed.length > 0) && <span className="sm:hidden">{failed.length || pendingCount}</span>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">{icon} {label}</DialogTitle>
            <DialogDescription>
              Scans are saved on this phone first and uploaded automatically whenever there is a connection.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Waiting to upload</span>
              <span className="font-medium">{pendingCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Last synced</span>
              <span className="font-medium">
                {lastSyncedAt ? formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true }) : 'not yet'}
              </span>
            </div>
            {lastError && online && <p className="text-xs text-muted-foreground">Last attempt: {lastError}</p>}
          </div>

          <Button onClick={sync} disabled={!online || syncing} className="w-full">
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {online ? 'Sync now' : 'Waiting for a connection'}
          </Button>

          {failed.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-medium">The server refused these changes</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {failed.map((entry) => (
                  <li key={entry.seq} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate">{describe(entry)}</div>
                      <div className="truncate text-xs text-muted-foreground">{entry.error}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Discard this change"
                      onClick={() => discardFailed(entry.seq!)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full" onClick={() => retryFailed().then(sync)}>
                Try them again
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
