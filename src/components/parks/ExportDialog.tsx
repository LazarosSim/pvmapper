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
import * as XLSX from 'xlsx';
import { Park } from '@/types/types';
import { Barcode } from '@/lib/types/db-types';
import { naturalCompare, toSafeSheetName, ensureUniqueSheetName, sortWorksheetEntries, type WorksheetEntry } from '@/lib/utils';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  park: Park;
  rows: { id: string; name: string; expectedBarcodes: number | null; currentBarcodes: number | null }[];
  progress: string;
  fetchBarcodesForRow: (rowId: string) => Promise<Barcode[]>;
}

type ExportMode = 'standard' | 'metlen';

const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onOpenChange,
  park,
  rows,
  progress,
  fetchBarcodesForRow,
}) => {
  const [mode, setMode] = useState<ExportMode>('standard');
  const [isExporting, setIsExporting] = useState(false);

  const sanitizeFileName = (name: string): string => {
    return name.replace(/[\\/:*?"<>|]/g, '_');
  };

  const buildSummarySheet = () => {
    const summaryData = [
      ['Park Name', park.name],
      ['Created', new Date(park.createdAt).toLocaleString()],
      ['Total Rows', rows.length.toString()],
      ['Total Barcodes', park.currentBarcodes.toString()],
      ['Expected Barcodes', park.expectedBarcodes.toString()],
      ['Completion', `${progress}%`],
    ];

    rows.forEach((row, index) => {
      summaryData.push([
        `Row ${index + 1}`,
        row.name,
        `Expected: ${row.expectedBarcodes || 'N/A'}`,
        `Current: ${row.currentBarcodes || 0}`,
      ]);
    });

    return XLSX.utils.aoa_to_sheet(summaryData);
  };

  const sortedRows = [...rows].sort((a, b) => naturalCompare(a.name, b.name));

  const handleStandardExport = async () => {
    const wb = XLSX.utils.book_new();
    const usedNames = new Set<string>();
    const worksheets: WorksheetEntry[] = [];

    const summaryWs = buildSummarySheet();
    const summaryName = ensureUniqueSheetName('Summary', usedNames);
    worksheets.push({ originalName: 'Summary', sheetName: summaryName, type: 'summary', worksheet: summaryWs });

    for (const row of sortedRows) {
      try {
        const rowBarcodes = await fetchBarcodesForRow(row.id);
        const rowData = [['Barcode']];
        if (rowBarcodes && rowBarcodes.length > 0) {
          rowBarcodes.forEach((barcode) => {
            rowData.push([barcode.code || '']);
          });
        }
        const ws = XLSX.utils.aoa_to_sheet(rowData);
        const safeName = ensureUniqueSheetName(toSafeSheetName(row.name), usedNames);
        worksheets.push({ originalName: row.name, sheetName: safeName, type: 'row', worksheet: ws });
      } catch (rowError) {
        console.error(`Error processing row ${row.name}:`, rowError);
        const ws = XLSX.utils.aoa_to_sheet([['Barcode']]);
        const safeName = ensureUniqueSheetName(toSafeSheetName(row.name), usedNames);
        worksheets.push({ originalName: row.name, sheetName: safeName, type: 'row', worksheet: ws });
      }
    }

    const sorted = sortWorksheetEntries(worksheets);
    sorted.forEach(({ sheetName, worksheet }) => {
      XLSX.utils.book_append_sheet(wb, worksheet, sheetName);
    });

    return wb;
  };

  const handleMetlenExport = async () => {
    const wb = XLSX.utils.book_new();

    // Summary tab
    const summaryWs = buildSummarySheet();
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Barcodes tab — all barcodes in one sheet
    const barcodesData: (string | number)[][] = [['A/A', 'ROW NAME', 'STRING NAME', 'SERIAL NUMBER']];

    for (const row of sortedRows) {
      try {
        const rowBarcodes = await fetchBarcodesForRow(row.id);
        if (rowBarcodes && rowBarcodes.length > 0) {
          rowBarcodes.forEach((barcode, index) => {
            barcodesData.push([
              index + 1,       // A/A — resets per row
              row.name,        // ROW NAME
              '',              // STRING NAME (empty)
              barcode.code || '', // SERIAL NUMBER
            ]);
          });
        }
      } catch (rowError) {
        console.error(`Error processing row ${row.name}:`, rowError);
      }
    }

    const barcodesWs = XLSX.utils.aoa_to_sheet(barcodesData);
    barcodesWs['!cols'] = [
      { wch: 6 },   // A/A
      { wch: 25 },  // ROW NAME
      { wch: 20 },  // STRING NAME
      { wch: 35 },  // SERIAL NUMBER
    ];
    XLSX.utils.book_append_sheet(wb, barcodesWs, 'Barcodes');

    return wb;
  };

  const handleExport = async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);
      toast.info('Starting export, please wait...');

      if (!rows || rows.length === 0) {
        toast.error('No rows data available for export.');
        setIsExporting(false);
        return;
      }

      const wb = mode === 'standard' ? await handleStandardExport() : await handleMetlenExport();

      const safeFileName = sanitizeFileName(
        `${park.name}_${mode === 'metlen' ? 'Metlen_' : ''}${new Date().toISOString().split('T')[0]}.xlsx`
      );

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
      const buf = new ArrayBuffer(wbout.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < wbout.length; i++) {
        view[i] = wbout.charCodeAt(i) & 0xff;
      }

      const blob = new Blob([buf], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = safeFileName;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsExporting(false);
        onOpenChange(false);
        toast.success('Park data exported successfully');
      }, 100);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(`Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
