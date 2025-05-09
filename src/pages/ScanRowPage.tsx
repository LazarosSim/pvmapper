
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
import { toast } from 'sonner';
import AuthGuard from '@/components/auth/auth-guard';
import BarcodeScanInput from '@/components/scan/BarcodeScanInput';
import RecentScans from '@/components/scan/RecentScans';
import ResetRowDialog from '@/components/scan/ResetRowDialog';
import RowHeader from '@/components/scan/RowHeader';
import AddBarcodeDialog from '@/components/dialog/add-barcode-dialog';

// Audio notification for success/error
const NOTIF_SOUND = "data:audio/wav;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAAFAAAGUACFhYWFhYWFhYWFhYWFhYWFhYWFra2tra2tra2tra2tra2tra2traOjo6Ojo6Ojo6Ojo6Ojo6Ojo6P///////////////////////////////////////////wAAADJMQVNNRTMuOTlyAc0AAAAAAAAAABSAJAJAQgAAgAAAA+aieizgAAAAAAAAAAAAAAAAAAAA//uQZAAAApEGUFUGAAArIMoKoMAABZAZnW40AAClAzOtxpgALEwy1AAAAAEVf7kGQRmBmD3QEAgEDhnePhI/JH4iByB+SPxA/IH5gQB+IPzAQA+TAMDhOIPA/IEInjB4P4fn///jHJ+T/ngfgYAgEAgEAgEAgg5nwuZIuZw5QmCvG0Ooy0JtC2CnAp1vdSlLMuOQylYZl0LERgAAAAAAlMy5z3O+n//zTjN/9/+Z//O//9y5/8ud/z//5EHL/D+KDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEppqampqampqampqampqampqampqampqampqampqamgAAA//tQZAAAAtAeUqsMAARfA7pVYYACCUCXPqggAEAAAP8AAAAATEFNRTMuOTkuNVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+xBkYA/wAAB/gAAACAAAD/AAAAEAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=";

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
    countBarcodesInRow // Import this function to count barcodes consistently
  } = useDB();
  
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [latestBarcodes, setLatestBarcodes] = useState<any[]>([]);
  
  // Track barcode count for UI updates
  const [scanCount, setScanCount] = useState(0);
  
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
      }
      
      // Set initial count
      if (rowId && barcodes) {
        const count = countBarcodesInRow(rowId);
        setScanCount(count);
      }
    }
  }, [rowId, rows, getRowById, barcodes, countBarcodesInRow]);

  // Update barcodes list whenever barcodes array changes
  useEffect(() => {
    if (rowId) {
      // Get the latest 10 barcodes for this row, sorted by timestamp (newest first)
      const rowBarcodes = getBarcodesByRowId(rowId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);
      
      setLatestBarcodes(rowBarcodes);
      
      // Update scan count whenever barcodes change
      const count = countBarcodesInRow(rowId);
      setScanCount(count);
    }
  }, [rowId, barcodes, getBarcodesByRowId, countBarcodesInRow]);

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
      // Reset scan count to 0
      setScanCount(0);
      
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
    setScanCount(prevCount => prevCount + 1);
  };

  return (
    <AuthGuard>
      <Layout title={breadcrumb || 'Scan Barcode'} showBack>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <RowHeader
                rowId={rowId}
                breadcrumb={breadcrumb}
                totalScannedBarcodes={scanCount}
                expectedBarcodes={row?.expectedBarcodes}
                isResetting={isResetting}
                onResetClick={() => setIsResetDialogOpen(true)}
                focusInput={focusInput}
              />
            </CardTitle>
            <CardDescription>
              Scan or enter a barcode to add it to this row
              {row?.expectedBarcodes ? ` (max: ${row.expectedBarcodes})` : ''}
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
      </Layout>
    </AuthGuard>
  );
};

export default ScanRowPage;
