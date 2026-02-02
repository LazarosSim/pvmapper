/**
 * Sync Progress Dialog
 * Shows sync progress with progress bar
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, CloudUpload, Loader2 } from 'lucide-react';
import type { SyncState } from '@/lib/offline/types';

interface SyncProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syncState: SyncState;
}

export const SyncProgressDialog = ({
  open,
  onOpenChange,
  syncState,
}: SyncProgressDialogProps) => {
  const { isSyncing, progress, total, error } = syncState;
  const percentage = total > 0 ? Math.round((progress / total) * 100) : 0;
  const isComplete = !isSyncing && progress === total && total > 0 && !error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSyncing && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            {isComplete && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {error && <AlertCircle className="h-5 w-5 text-destructive" />}
            {!isSyncing && !isComplete && !error && <CloudUpload className="h-5 w-5 text-primary" />}
            
            {isSyncing && 'Syncing...'}
            {isComplete && 'Sync Complete'}
            {error && 'Sync Failed'}
            {!isSyncing && !isComplete && !error && 'Ready to Sync'}
          </DialogTitle>
          <DialogDescription>
            {isSyncing && `Uploading ${progress} of ${total} barcodes to server`}
            {isComplete && `Successfully synced ${total} barcode${total > 1 ? 's' : ''}`}
            {error && error}
            {!isSyncing && !isComplete && !error && 'Press the sync button to start'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Progress value={percentage} className="h-3" />
          
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{progress} / {total}</span>
            <span>{percentage}%</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
