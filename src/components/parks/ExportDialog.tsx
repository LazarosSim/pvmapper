import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, FileSpreadsheet, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { buildWorkbook, exportFileName, loadParkExportData, type ExportMode, type ExportPark } from '@/lib/park-export';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  park: ExportPark;
}

const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onOpenChange,
  park,
}) => {
  const [mode, setMode] = useState<ExportMode>('standard');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);
      toast.info('Starting export, please wait...');

      // The Excel library is large: loaded only when exporting
      const [XLSX, data] = await Promise.all([import('xlsx'), loadParkExportData(park)]);

      if (data.rows.length === 0) {
        toast.error('No rows data available for export.');
        return;
      }
      if (data.unsentCount > 0) {
        toast.warning(`${data.unsentCount} scan${data.unsentCount > 1 ? 's are' : ' is'} not uploaded yet; the file includes them.`);
      }

      XLSX.writeFile(buildWorkbook(XLSX, mode, park, data), exportFileName(park, mode));
      onOpenChange(false);
      toast.success('Park data exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(`Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Park Data</DialogTitle>
          <DialogDescription>Choose an export format for "{park.name}".</DialogDescription>
        </DialogHeader>

        <RadioGroup value={mode} onValueChange={(v) => setMode(v as ExportMode)} className="space-y-3 py-4">
          <div className="flex items-start space-x-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
               onClick={() => setMode('standard')}>
            <RadioGroupItem value="standard" id="standard" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="standard" className="flex items-center gap-2 cursor-pointer font-medium">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                Standard
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                One tab per row with barcodes, plus a Summary tab.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
               onClick={() => setMode('metlen')}>
            <RadioGroupItem value="metlen" id="metlen" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="metlen" className="flex items-center gap-2 cursor-pointer font-medium">
                <Table2 className="h-4 w-4 text-muted-foreground" />
                Metlen Standard
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                All barcodes in a single sheet with A/A, Row Name, String Name, and Serial Number columns.
              </p>
            </div>
          </div>
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting} className="bg-inventory-primary hover:bg-inventory-primary/90">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportDialog;
