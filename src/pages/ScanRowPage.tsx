
import React, { useRef, useState, useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import Layout from '@/components/layout/layout';
import { useDB } from '@/lib/db-provider';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { toast } from 'sonner';
import AuthGuard from '@/components/auth/auth-guard';
import BarcodeScanInput from '@/components/scan/BarcodeScanInput';
import RecentScans from '@/components/scan/RecentScans';
import ResetRowDialog from '@/components/scan/ResetRowDialog';
import AddBarcodeDialog from '@/components/dialog/add-barcode-dialog';

// Audio notification for success/error
const NOTIF_SOUND = "data:audio/wav;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAAFAAAGUACFhYWFhYWFhYWFhYWFhYWFhYWFra2tra2tra2tra2tra2tra2traOjo6Ojo6Ojo6Ojo6Ojo6Ojo6P///////////////////////////////////////////wAAADJMQVNNRTMuOTlyAc0AAAAAAAAAABSAJAJAQgAAgAAAA+aieizgAAAAAAAAAAAAAAAAAAAA//uQZAAAApEGUFUGAAArIMoKoMAABZAZnW40AAClAzOtxpgALEwy1AAAAAEVf7kGQRmBmD3QEAgEDhnePhI/JH4iByB+SPxA/IH5gQB+IPzAQA+TAMDhOIPA/IEInjB4P4fn///jHJ+T/ngfgYAgEAgEAgEAgg5nwuZIuZw5QmCvG0Ooy0JtC2CnAp1vdSlLMuOQylYZl0LERgAAAAAAlMy5z3O+n//zTjN/9/+Z//O//9y5/8ud/z//5EHL/D+KDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEppqampqampqampqampqampqampqampqampqampqamgAAA//tQZAAAAtAeUqsMAARfA7pVYYACCUCXPqggAEAAAP8AAAAATEFNRTMuOTkuNVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+xBkYA/wAAB/gAAACAAAD/AAAAEAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=";

const ScanRowPage = () => {
  const { rowId } = useParams<{ rowId: string }>();
  const { 
    rows, 
    getRowById, 
    getParkById,
    barcodes,
    getBarcodesByRowId, 
    currentUser,
    resetRow,
    countBarcodesInRow,
    updateRow
  } = useDB();
  
  // State for dialogs and UI
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [latestBarcodes, setLatestBarcodes] = useState<any[]>([]);
  const [scanCount, setScanCount] = useState(0);
  const [isAddBarcodeDialogOpen, setIsAddBarcodeDialogOpen] = useState(false);
  
  // State for editing row name
  const [isEditingRowName, setIsEditingRowName] = useState(false);
  const [rowName, setRowName] = useState('');
  
  // State for location capture - default to true
  const [captureLocation, setCaptureLocation] = useState(true);
  
  // Reference to the audio element
  const audioRef = useRef<HTMLAudioElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Function to focus the input field
  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Update count and save selected row and park to localStorage for consistent navigation
  useEffect(() => {
    if (rowId && rows.some(r => r.id === rowId)) {
      localStorage.setItem('selectedRowId', rowId);
      const row = getRowById(rowId);
      if (row) {
        localStorage.setItem('selectedParkId', row.parkId);
        setRowName(row.name);
        // Use the currentBarcodes property from the row
        setScanCount(row.currentBarcodes);
      }
    }
  }, [rowId, rows, getRowById]);

  // Update barcodes list whenever barcodes array changes
  useEffect(() => {
    if (rowId) {
      // Get the latest 10 barcodes for this row, sorted by timestamp (newest first)
      const rowBarcodes = getBarcodesByRowId(rowId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);
      
      setLatestBarcodes(rowBarcodes);
      
      // Get the current row to update scan count directly from row data
      const row = getRowById(rowId);
      if (row) {
        setScanCount(row.currentBarcodes);
      }
    }
  }, [rowId, barcodes, getBarcodesByRowId, getRowById, rows]);

  // Focus the input when the component mounts
  useEffect(() => {
    focusInput();
  }, []);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!rowId || !rows.some(r => r.id === rowId)) {
    // Try to get remembered row from localStorage
    const rememberedRowId = localStorage.getItem('selectedRowId');
    if (rememberedRowId && rows.some(r => r.id === rememberedRowId)) {
      return <Navigate to={`/scan/row/${rememberedRowId}`} replace />;
    }
    
    // If no remembered row, try to get remembered park
    const rememberedParkId = localStorage.getItem('selectedParkId');
    if (rememberedParkId) {
      return <Navigate to={`/scan/park/${rememberedParkId}`} replace />;
    }
    
    return <Navigate to="/scan" replace />;
  }

  // Get the current row
  const row = getRowById(rowId);
  // Get the park this row belongs to
  const park = row ? getParkById(row.parkId) : undefined;
  // Create breadcrumb format
  const breadcrumb = park ? `${park.name} / ${row?.name}` : row?.name;

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetRow(rowId);
      // Clear the local state of barcodes
      setLatestBarcodes([]);
      // Scan count will be updated by the row's currentBarcodes from useEffect
      
      setIsResetDialogOpen(false);
      toast.success('Row reset successfully');
    } catch (error) {
      console.error("Error resetting row:", error);
      toast.error("Failed to reset row");
    } finally {
      setIsResetting(false);
      focusInput();
    }
  };

  const handleBarcodeAdded = (barcode: any) => {
    // Update the list of recent barcodes (newest first)
    const updatedBarcodes = [
      { ...barcode, timestamp: new Date().toISOString() },
      ...latestBarcodes.slice(0, 9)
    ];
    setLatestBarcodes(updatedBarcodes);
    
    // Increment scan count immediately for better UI feedback
    // The real count will be updated by the useEffect using currentBarcodes
    setScanCount(prevCount => prevCount + 1);
  };

  const startEditingName = () => {
    if (row) {
      setRowName(row.name);
      setIsEditingRowName(true);
    }
  };
  
  const saveRowName = async () => {
    if (rowName.trim()) {
      await updateRow(rowId, rowName);
      setIsEditingRowName(false);
      toast.success("Row name updated successfully");
    } else {
      toast.error("Row name cannot be empty");
    }
    focusInput();
  };

  const cancelEditName = () => {
    setIsEditingRowName(false);
    focusInput();
  };

  return (
    <AuthGuard>
      <Layout 
        title={breadcrumb || 'Scan Barcode'}
        showBack
        showSettings={true}
        rowId={rowId}
        captureLocation={captureLocation}
        setCaptureLocation={setCaptureLocation}
        onReset={() => setIsResetDialogOpen(true)}
        onRename={startEditingName}
      >
        {isEditingRowName && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-4 rounded-lg shadow-lg w-80">
              <h3 className="font-medium mb-2">Rename Row</h3>
              <Input
                value={rowName}
                onChange={(e) => setRowName(e.target.value)}
                className="mb-4"
                autoFocus
              />
              <div className="flex justify-end space-x-2">
                <Button variant="outline" size="sm" onClick={cancelEditName}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={saveRowName}>
                  <Check className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <span>
                  Scanned: <span className="font-bold">{scanCount}</span> 
                  {row?.expectedBarcodes ? ` / ${row.expectedBarcodes}` : ''}
                </span>
              </div>
            </CardTitle>
            <CardDescription>
              Scan or enter a barcode to add it to this row
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="pr-12 relative">
              <BarcodeScanInput
                rowId={rowId}
                onBarcodeAdded={handleBarcodeAdded}
                focusInput={focusInput}
              />
            </div>
            <audio ref={audioRef} src={NOTIF_SOUND} />
            <RecentScans barcodes={latestBarcodes} />
          </CardContent>
        </Card>

        <ResetRowDialog
          isOpen={isResetDialogOpen}
          onOpenChange={setIsResetDialogOpen}
          onReset={handleReset}
          onCancel={() => focusInput()}
        />

        <AddBarcodeDialog
          open={isAddBarcodeDialogOpen}
          onOpenChange={setIsAddBarcodeDialogOpen}
          rowId={rowId}
          onBarcodeAdded={handleBarcodeAdded}
          captureLocation={captureLocation}
          setCaptureLocation={setCaptureLocation}
        />
      </Layout>
    </AuthGuard>
  );
};

export default ScanRowPage;
