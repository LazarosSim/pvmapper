
import React, { useState } from 'react';
import Layout from '@/components/layout/layout';
import { useDB } from '@/lib/db-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { utils as XLSXUtils, writeFile as writeXLSXFile } from 'xlsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Save, FileUp, AlertTriangle, FileText, RefreshCw, Mail } from 'lucide-react';

const BackupPage = () => {
  const { parks, rows, barcodes, importData, exportData } = useDB();
  const [importContent, setImportContent] = useState('');
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedParkId, setSelectedParkId] = useState<string>('all');

  const handleExportExcel = () => {
    try {
      const workbook = XLSXUtils.book_new();
      const parksToExport = selectedParkId === 'all' 
        ? parks 
        : parks.filter(park => park.id === selectedParkId);

      parksToExport.forEach(park => {
        const parkRows = rows.filter(row => row.parkId === park.id);
        
        // Create a worksheet for each row in the park
        parkRows.forEach(row => {
          const rowBarcodes = barcodes.filter(barcode => barcode.rowId === row.id);
          
          if (rowBarcodes.length > 0) {
            // Create worksheet with only barcode values
            const barcodeData = rowBarcodes.map(barcode => ({ 'Barcode': barcode.code }));
            const worksheet = XLSXUtils.json_to_sheet(barcodeData);
            
            // Limit sheet name to 31 characters (Excel limitation)
            const sheetName = `${park.name.slice(0, 15)}_${row.name.slice(0, 15)}`.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 31);
            XLSXUtils.book_append_sheet(workbook, worksheet, sheetName);
          }
        });
        
        // Create a summary sheet for the park
        const parkSummaryData = [
          ['Park Name', park.name],
          ['Created', new Date(park.createdAt).toLocaleString()],
          ['Expected Barcodes', park.expectedBarcodes.toString()],
          ['Total Rows', parkRows.length.toString()],
          ['Total Barcodes', parkRows.reduce((sum, row) => sum + (row.currentBarcodes || 0), 0).toString()],
        ];
        
        parkRows.forEach(row => {
          parkSummaryData.push([
            `Row: ${row.name}`,
            `${row.currentBarcodes || 0} barcodes`
          ]);
        });
        
        const summarySheet = XLSXUtils.aoa_to_sheet(parkSummaryData);
        XLSXUtils.book_append_sheet(workbook, summarySheet, `${park.name.slice(0, 28)}_Summary`.replace(/[^a-zA-Z0-9]/g, '_'));
      });

      const fileName = selectedParkId === 'all' 
        ? `inventory-export-${new Date().toISOString().split('T')[0]}.xlsx`
        : `${parks.find(p => p.id === selectedParkId)?.name}-export-${new Date().toISOString().split('T')[0]}.xlsx`;

      writeXLSXFile(workbook, fileName);
      toast.success("Excel file exported successfully");
      return fileName;
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export Excel file");
      return null;
    }
  };

  // NEW EMAIL EXPORT: exports and opens mail client for attachment
  const handleExportAndEmail = () => {
    const fileName = handleExportExcel();
    if (fileName) {
      setTimeout(() => {
        toast.info(
          <>
            <span className='font-medium'>To send the file via email:</span>
            <ul className="list-disc list-inside mt-1 text-muted-foreground text-xs">
              <li>Open your email client by clicking the button below.</li>
              <li>Attach the exported Excel file (<b>{fileName}</b>) to the email draft.</li>
              <li>Send to recipient.</li>
            </ul>
            <a
              href={`mailto:?subject=Inventory Export&body=Please find the exported inventory Excel file attached.&attach=${fileName}`}
              className="block mt-3 underline text-inventory-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Email Client
            </a>
          </>
        );
      }, 800);
    }
  };

  const handleImport = () => {
    try {
      JSON.parse(importContent);
      setIsImportDialogOpen(true);
    } catch (e) {
      toast.error("Invalid JSON format. Please check your import data.");
    }
  };

  const confirmImport = () => {
    const success = importData(importContent);
    if (success) {
      setImportContent('');
      setIsImportDialogOpen(false);
    }
  };

  const stats = {
    parks: parks.length,
    rows: rows.length,
    barcodes: barcodes.length
  };

  return (
    <Layout title="Backup & Restore">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Save className="mr-2 h-5 w-5 text-inventory-primary" />
              Current Data
            </CardTitle>
            <CardDescription>
              Overview of your inventory data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="border rounded-md p-4">
                <p className="text-3xl font-bold text-inventory-primary">{stats.parks}</p>
                <p className="text-sm text-muted-foreground">Parks</p>
              </div>
              <div className="border rounded-md p-4">
                <p className="text-3xl font-bold text-inventory-primary">{stats.rows}</p>
                <p className="text-sm text-muted-foreground">Rows</p>
              </div>
              <div className="border rounded-md p-4">
                <p className="text-3xl font-bold text-inventory-primary">{stats.barcodes}</p>
                <p className="text-sm text-muted-foreground">Barcodes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Download className="mr-2 h-5 w-5 text-inventory-primary" />
              Export Data
            </CardTitle>
            <CardDescription>
              Download your inventory data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Select
                value={selectedParkId}
                onValueChange={setSelectedParkId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a park to export" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Parks</SelectItem>
                  {parks.map((park) => (
                    <SelectItem key={park.id} value={park.id}>
                      {park.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleExportExcel} className="w-full">
                <FileText className="mr-2 h-4 w-4" />
                Export to Excel
              </Button>
              <Button onClick={handleExportAndEmail} className="w-full" variant="secondary">
                <Mail className="mr-2 h-4 w-4" />
                Export & Email (Instructions)
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileUp className="mr-2 h-5 w-5 text-inventory-primary" />
              Import Data
            </CardTitle>
            <CardDescription>
              Restore from a previous backup
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Paste your backup data here..."
              value={importContent}
              onChange={(e) => setImportContent(e.target.value)}
              className="min-h-[150px]"
            />
            <Button 
              onClick={handleImport} 
              disabled={!importContent.trim()}
              className="w-full"
            >
              <FileUp className="mr-2 h-4 w-4" />
              Import Data
            </Button>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
              Warning: This will overwrite your data
            </AlertDialogTitle>
            <AlertDialogDescription>
              Importing this data will replace all your current inventory data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmImport} className="bg-destructive text-destructive-foreground">
              Yes, Import Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default BackupPage;
