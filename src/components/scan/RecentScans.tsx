import React from 'react';
import { Cloud, CloudOff, Pencil, Trash2 } from 'lucide-react';

interface RecentScansProps {
  barcodes?: Array<{
    id: string;
    code: string;
    timestamp?: string;
    isPending?: boolean;
    isDeleting?: boolean;
    pendingCode?: string;
  }>;
}

const RecentScans: React.FC<RecentScansProps> = ({ barcodes }) => {
  if (!barcodes || barcodes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xl font-bold">last 10 scans</h3>
      <div className="space-y-1">
        {barcodes.map((barcode, index) => {
          // Determine sync status
          const isDeleting = barcode.isDeleting;
          const hasUpdate = barcode.pendingCode && barcode.pendingCode !== barcode.code;
          const isPending = barcode.isPending;

          return (
            <div 
              key={barcode.id} 
              className={`text-sm flex items-center gap-2 ${
                index === 0 
                  ? 'text-foreground font-medium animate-in fade-in slide-in-from-bottom-2' 
                  : 'text-muted-foreground'
              } ${isDeleting ? 'line-through opacity-50' : ''}`}
            >
              {/* Status icon */}
              {isDeleting ? (
                <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" aria-label="Pending deletion" />
              ) : hasUpdate ? (
                <Pencil className="h-3 w-3 text-amber-500 flex-shrink-0" aria-label="Pending update" />
              ) : isPending ? (
                <CloudOff className="h-3 w-3 text-amber-500 flex-shrink-0" aria-label="Pending sync" />
              ) : (
                <Cloud className="h-3 w-3 text-green-500 flex-shrink-0" aria-label="Synced" />
              )}
              <span className="truncate">{barcode.code}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentScans;
