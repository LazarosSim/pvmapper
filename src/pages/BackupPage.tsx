import React, {useState} from 'react';
import Layout from '@/components/layout/layout';
import {useDB} from '@/lib/db-provider';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Textarea} from '@/components/ui/textarea';
import {toast} from 'sonner';
import {utils as XLSXUtils, writeFile as writeXLSXFile} from 'xlsx';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";
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
import {AlertTriangle, Download, FileText, FileUp, Mail, Save} from 'lucide-react';
import {supabase} from '@/integrations/supabase/client';
import type {Barcode} from '@/lib/types/db-types';

const BackupPage = () => {
  const { parks, rows, barcodes, importData, exportData } = useDB();
  const [importContent, setImportContent] = useState('');
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedParkId, setSelectedParkId] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

  // Function to fetch barcodes for a specific row directly from the database
  const fetchBarcodesForRow = async (rowId: string): Promise<Barcode[]> => {
    try {
      const { data, error } = await supabase
        .from('barcodes')
        .select('*')
        .eq('row_id', rowId)
          .order('order_in_row', {ascending: true});

      if (error) {
        console.error('Error fetching barcodes for row:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map(barcode => ({
        id: barcode.id,
        code: barcode.code,
        rowId: barcode.row_id,
        userId: barcode.user_id,
        timestamp: barcode.timestamp,
        orderInRow: barcode.order_in_row,
        latitude: barcode.latitude,
        longitude: barcode.longitude
      }));
    } catch (error) {
      console.error('Error in fetchBarcodesForRow:', error);
      return [];
    }
  };

  const handleExportExcel = async () => {
    if (isExporting) return;
    
    try {
      setIsExporting(true);
      toast.info('Starting export, please wait...');
      
      // Validate data availability
      if (!parks || parks.length === 0) {
        toast.error('No parks data available for export.');
        setIsExporting(false);
        return;
      }

      if (!rows || rows.length === 0) {
        toast.error('No rows data available for export.');
        setIsExporting(false);
        return;
      }
      
      const workbook = XLSXUtils.book_new();
      const parksToExport = selectedParkId === 'all' 
        ? parks 
        : parks.filter(park => park.id === selectedParkId);

      if (parksToExport.length === 0) {
        toast.error('No parks selected for export.');
        setIsExporting(false);
        return;
      }

      for (const park of parksToExport) {
        try {
          const parkRows = rows.filter(row => row.parkId === park.id) || [];
          
          // First create a summary sheet for the park
          const parkSummaryData = [
            ['Park Name', park.name],
            ['Created', new Date(park.createdAt).toLocaleString()],
            ['Expected Barcodes', park.expectedBarcodes.toString()],
            ['Total Rows', parkRows.length.toString()],
            ['Total Barcodes', parkRows.reduce((sum, row) => sum + (row.currentBarcodes || 0), 0).toString()],
          ];
          
          // Add row information to the summary
          parkRows.forEach(row => {
            parkSummaryData.push([
              `Row: ${row.name}`,
              `Expected: ${row.expectedBarcodes || "N/A"}`,
              `Current: ${row.currentBarcodes || 0} barcodes`
            ]);
          });
          
          const summarySheet = XLSXUtils.aoa_to_sheet(parkSummaryData);
          const summarySheetName = `${park.name.slice(0, 28)}_Summary`.replace(/[^a-zA-Z0-9]/g, '_');
          XLSXUtils.book_append_sheet(workbook, summarySheet, summarySheetName);
          
          // Create a worksheet for each row, regardless of whether it has barcodes or not
          for (const row of parkRows) {
            try {
              // Fetch barcodes for this row directly from the database
              const rowBarcodes = await fetchBarcodesForRow(row.id);
              
              // Create worksheet data with header
              const rowData = [["Barcode"]]; // Start with header row
              
              // Add all barcodes if available
              if (rowBarcodes && rowBarcodes.length > 0) {
                rowBarcodes.forEach(barcode => {
                  rowData.push([barcode.code || '']);
                });
              }
              
              // Create the worksheet (even if empty, it will just have the header)
              const worksheet = XLSXUtils.aoa_to_sheet(rowData);
              
              // Limit sheet name to 31 characters (Excel limitation)
              const sheetName = `${park.name.slice(0, 15)}_${row.name.slice(0, 15)}`
                .replace(/[^a-zA-Z0-9]/g, '_')
                .slice(0, 31);
              
              XLSXUtils.book_append_sheet(workbook, worksheet, sheetName);
            } catch (rowError) {
              console.error(`Error processing row ${row.name}:`, rowError);
              // Create empty sheet for this row if there's an error
              const emptyRowData = [["Barcode"]];
              const worksheet = XLSXUtils.aoa_to_sheet(emptyRowData);
              const sheetName = `${park.name.slice(0, 15)}_${row.name.slice(0, 15)}`
                .replace(/[^a-zA-Z0-9]/g, '_')
                .slice(0, 31);
              XLSXUtils.book_append_sheet(workbook, worksheet, sheetName);
            }
          }
        } catch (parkError) {
          console.error(`Error processing park ${park.name}:`, parkError);
          toast.error(`Error processing park ${park.name}: ${parkError instanceof Error ? parkError.message : 'Unknown error'}`);
        }
      }

      const fileName = selectedParkId === 'all' 
        ? `inventory-export-${new Date().toISOString().split('T')[0]}.xlsx`
        : `${parks.find(p => p.id === selectedParkId)?.name || 'unknown'}-export-${new Date().toISOString().split('T')[0]}.xlsx`;

      writeXLSXFile(workbook, fileName);
      setIsExporting(false);
      toast.success("Excel file exported successfully");
      return fileName;
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(`Failed to export Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsExporting(false);
      return null;
    }
  };

  // NEW EMAIL EXPORT: exports and opens mail client for attachment
  const handleExportAndEmail = async () => {
    const fileName = await handleExportExcel();
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
    parks: parks?.length || 0,
    rows: rows?.length || 0,
    barcodes: barcodes?.length || 0
  };

  const hasData = parks && parks.length > 0 && rows && rows.length > 0;

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
                disabled={!hasData}
              >
                <SelectTrigger>
                  <SelectValue placeholder={hasData ? "Select a park to export" : "No data available"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Parks</SelectItem>
                  {parks?.map((park) => (
                    <SelectItem key={park.id} value={park.id}>
                      {park.name}
                    </SelectItem>
                  )) || []}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleExportExcel} 
                className="w-full" 
                disabled={isExporting || !hasData}
                title={!hasData ? "Export disabled: No data available" : "Export to Excel"}
              >
                <FileText className="mr-2 h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export to Excel'}
              </Button>
              <Button 
                onClick={handleExportAndEmail} 
                className="w-full" 
                variant="secondary" 
                disabled={isExporting || !hasData}
                title={!hasData ? "Export disabled: No data available" : "Export & Email"}
              >
                <Mail className="mr-2 h-4 w-4" />
                Export & Email (Instructions)
              </Button>
              {!hasData && (
                <p className="text-sm text-muted-foreground text-center">
                  No parks or rows available for export
                </p>
              )}
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
