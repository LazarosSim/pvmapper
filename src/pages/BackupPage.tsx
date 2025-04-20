import React, { useState } from 'react';
import Layout from '@/components/layout/layout';
import { useDB } from '@/lib/db-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { utils as XLSXUtils, writeFile as writeXLSXFile } from 'xlsx';
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
import { Download, Save, FileUp, AlertTriangle, FileText } from 'lucide-react';

const BackupPage = () => {
  const { parks, rows, barcodes, importData, exportData } = useDB();
  const [importContent, setImportContent] = useState('');
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const handleExportExcel = () => {
    try {
      // Create worksheets for each park
      const workbook = XLSXUtils.book_new();
      
      parks.forEach(park => {
        // Get rows for this park
        const parkRows = rows.filter(row => row.parkId === park.id);
        
        // Get barcodes for all rows in this park
        const parkBarcodeData = parkRows.flatMap(row => {
          const rowBarcodes = barcodes.filter(barcode => barcode.rowId === row.id);
          return rowBarcodes.map(barcode => ({
            'Park Name': park.name,
            'Row Name': row.name,
            'Barcode': barcode.code,
            'Scanned At': new Date(barcode.timestamp).toLocaleString(),
          }));
        });

        // Create worksheet only if park has data
        if (parkBarcodeData.length > 0) {
          const worksheet = XLSXUtils.json_to_sheet(parkBarcodeData);
          XLSXUtils.book_append_sheet(workbook, worksheet, park.name.slice(0, 31)); // Excel sheet names limited to 31 chars
        }
      });

      // Save the file
      writeXLSXFile(workbook, `inventory-export-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Excel file exported successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export Excel file");
    }
  };

  const handleExport = () => {
    const data = exportData();
    
    // Create a download link for the JSON file
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(data);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `inventory-backup-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    toast.success("Backup exported successfully");
  };

  const handleImport = () => {
    try {
      // Validate the import data before opening the confirmation dialog
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
            <Button onClick={handleExportExcel} className="w-full">
              <FileText className="mr-2 h-4 w-4" />
              Export to Excel
            </Button>
            
            <Button onClick={handleExport} variant="outline" className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Export Backup (JSON)
            </Button>
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
