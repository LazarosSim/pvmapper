import React, {useEffect, useRef, useState} from 'react';
import {Navigate, useParams} from 'react-router-dom';
import Layout from '@/components/layout/layout';
import {useDB} from '@/lib/db-provider';
import {Card, CardContent, CardDescription, CardHeader, CardTitle,} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {Check, X} from "lucide-react";
import {toast} from 'sonner';
import AuthGuard from '@/components/auth/auth-guard';
import BarcodeScanInput from '@/components/scan/BarcodeScanInput';
import RecentScans from '@/components/scan/RecentScans';
import ResetRowDialog from '@/components/scan/ResetRowDialog';
import {useRow} from "@/hooks/use-row-queries.tsx";
import {useResetRowBarcodes, useRowBarcodes,} from "@/hooks/use-barcodes-queries.tsx";

// Audio notification for success/error
const NOTIF_SOUND = "data:audio/wav;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAAFAAAGUACFhYWFhYWFhYWFhYWFhYWFhYWFra2tra2tra2tra2tra2tra2traOjo6Ojo6Ojo6Ojo6Ojo6Ojo6P///////////////////////////////////////////wAAADJMQVNNRTMuOTlyAc0AAAAAAAAAABSAJAJAQgAAgAAAA+aieizgAAAAAAAAAAAAAAAAAAAA//uQZAAAApEGUFUGAAArIMoKoMAABZAZnW40AAClAzOtxpgALEwy1AAAAAEVf7kGQRmBmD3QEAgEDhnePhI/JH4iByB+SPxA/IH5gQB+IPzAQA+TAMDhOIPA/IEInjB4P4fn///jHJ+T/ngfgYAgEAgEAgEAgg5nwuZIuZw5QmCvG0Ooy0JtC2CnAp1vdSlLMuOQylYZl0LERgAAAAAAlMy5z3O+n//zTjN/9/+Z//O//9y5/8ud/z//5EHL/D+KDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEppqampqampqampqampqampqampqampqampqampqamgAAA//tQZAAAAtAeUqsMAARfA7pVYYACCUCXPqggAEAAAP8AAAAATEFNRTMuOTkuNVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+xBkYA/wAAB/gAAACAAAD/AAAAEAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=";

const ScanRowPage = () => {

  const { rowId } = useParams<{ rowId: string }>();
  const { 
    rows, 
    currentUser,
    updateRow
  } = useDB();
  
  // State for dialogs and UI
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

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


  const {data: row, isLoading, isError } = useRow(rowId);
  const {mutate: resetRow} = useResetRowBarcodes(rowId);

  const {data: barcodes} = useRowBarcodes(rowId);

  if (isError) {
    toast.error("Failed to fetch row data");
  }

  const latestBarcodes = barcodes?.slice(-10).reverse();
  const scanCount = Math.max(barcodes?.length || 0, 0);

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

  // Create breadcrumb format
  const breadcrumb = row ? `${row.park.name} / ${row?.name}` : row?.name;

  const handleReset = async () => {
    setIsResetDialogOpen(true);
    resetRow(rowId, {
      onSuccess: (affectedBarcodes) => {
        if (!affectedBarcodes || affectedBarcodes === 0) {
          toast.info("Row is already empty");
        }else{
          toast.success("Successfully reset " + affectedBarcodes + " barcode" +(affectedBarcodes > 1 ? "s" : ""));
        }
      },
      onError: (error) => {
        console.error("Error resetting row:", error);
        toast.error("Failed to reset row");
      },
      onSettled: () => {
        setIsResetDialogOpen(false);
      }
    });
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
                  {row?.expectedBarcodes ? ` / ${row.expectedBarcodes}` : '/∞'}
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
