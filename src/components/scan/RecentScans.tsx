
import React from 'react';

interface RecentScansProps {
  barcodes: Array<{
    id: string;
    code: string;
    timestamp?: string;
  }>;
}

const RecentScans: React.FC<RecentScansProps> = ({ barcodes }) => {
  if (barcodes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Recent Scans ({barcodes.length})</h3>
      <div className="space-y-1">
        {barcodes.map((barcode, index) => (
          <div 
            key={barcode.id} 
            className={`text-sm ${index === 0 ? 'text-foreground font-medium animate-in fade-in slide-in-from-bottom-2' : 'text-muted-foreground'}`}
          >
            {barcode.code}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentScans;
