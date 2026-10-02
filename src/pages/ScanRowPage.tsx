import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import Layout from '@/components/layout/layout';
import { useDB } from '@/lib/db-provider';
import { Card, CardContent, CardHeader, CardTitle, } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, CheckCircle2, X } from "lucide-react";
import { toast } from 'sonner';
import AuthGuard from '@/components/auth/auth-guard';
import BarcodeScanInput, { type QueuedScan } from '@/components/scan/BarcodeScanInput';
import RecentScans from '@/components/scan/RecentScans';
import ResetRowDialog from '@/components/scan/ResetRowDialog';
import { useNextRow, usePark, useRow, useRowBarcodes } from '@/lib/local/hooks';
import { resetRow as resetLocalRow } from '@/lib/local/repo';
import { OfflineStatusBanner } from "@/components/offline/OfflineStatusBanner";

const ScanRowPage = () => {

  const { rowId } = useParams<{ rowId: string }>();
  const {
    updateRow
  } = useDB();

  // State for dialogs and UI
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  // State for editing row name
  const [isEditingRowName, setIsEditingRowName] = useState(false);
  const [rowName, setRowName] = useState('');

  // State for location capture - default to true
  const [captureLocation, setCaptureLocation] = useState(true);

  // The scan input, so dialogs can hand focus back to it
  const inputRef = useRef<HTMLInputElement>(null);

  // Function to focus the input field
  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };


  const { row: localOrServerRow, isLocal } = useRow(rowId);
  const barcodes = useRowBarcodes(rowId, isLocal);
  const isLoading = localOrServerRow === undefined;
  // Scanning works on the phone's copy of active parks
  const row = isLocal ? localOrServerRow : null;

  const park = usePark(row?.parkId);

  // The row after this one in the park, for "Next row" when this one is complete
  const nextRow = useNextRow(row?.parkId, rowId);

  // Scans accepted but not saved yet: counted and listed right away
  const [queued, setQueued] = useState<QueuedScan[]>([]);

  // Persist selected row/park for convenience elsewhere (not for refresh routing)
  useEffect(() => {
    if (rowId) localStorage.setItem('selectedRowId', rowId);
  }, [rowId]);

  const savedIds = new Set(barcodes?.map(b => b.id));
  const allScans = [
    ...(barcodes ?? []).map(b => ({ id: b.id, code: b.code, isPending: b.pending === 1 })),
    ...queued.filter(q => !savedIds.has(q.id)).map(q => ({ id: q.id, code: q.code, isPending: true })),
  ];
  const latestBarcodes = allScans.slice(-10).reverse();
  const scanCount = allScans.length;
  const expected = row?.expectedBarcodes ?? 0;
  const isComplete = expected > 0 && scanCount >= expected;

  // Focus the input when the component mounts
  useEffect(() => {
    focusInput();
  }, []);

  // If the URL doesn't have a rowId, we can't deep-link.
  if (!rowId) return <Navigate to="/scan" replace />;

  if (isLoading) {
    return (
      <AuthGuard>
        <Layout title="Loading row..." showBack>
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </Layout>
      </AuthGuard>
    );
  }

  // Generic error UI if row is missing for any reason
  if (!row) {
    return (
      <AuthGuard>
        <Layout title="Row Not Found" showBack>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="text-destructive text-center">
              <p className="font-medium">Row not found</p>
              <p className="text-sm text-muted-foreground mt-2">
                This row is not on this phone. Only rows of active parks can be scanned.
              </p>
              <p className="text-sm text-muted-foreground">
                If it was just added, connect once so the phone can download it.
              </p>
            </div>
            <Button onClick={() => window.history.back()} variant="outline">
              Go Back
            </Button>
          </div>
        </Layout>
      </AuthGuard>
    );
  }

  // Create breadcrumb format
  const breadcrumb = `${row.parkName} / ${row.name}`;

  const handleReset = async () => {
    setIsResetDialogOpen(false);
    try {
      const affectedBarcodes = await resetLocalRow(rowId);
      if (!affectedBarcodes) {
        toast.info("Row is already empty");
      } else {
        toast.success("Successfully reset " + affectedBarcodes + " barcode" + (affectedBarcodes > 1 ? "s" : ""));
      }
    } catch (error) {
      console.error("Error resetting row:", error);
      toast.error("Failed to reset row");
    }
    focusInput();
  };


  const startEditingName = () => {
    if (row) {
      setRowName(row.name);
      setIsEditingRowName(true);
    }
  };

  const saveRowName = async () => {
    if (rowName.trim()) {
      // updateRow reports success or failure itself
      await updateRow(rowId, rowName.trim());
      setIsEditingRowName(false);
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
      <OfflineStatusBanner />
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
        <Card className="glass-card relative overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className={`flex items-center gap-1 ${isComplete ? 'text-green-700' : ''}`}>
                <span>
                  Scanned: <span className="font-bold">{scanCount}</span>
                  {expected > 0 ? ` / ${expected}` : ''}
                </span>
                {isComplete && <CheckCircle2 className="h-5 w-5" aria-label="Row complete" />}
              </span>
              {isComplete && nextRow && (
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link to={`/scan/row/${nextRow.id}`} replace title={`Next row: ${nextRow.name}`}>
                    Next <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="pr-12 relative">
              <BarcodeScanInput
                key={rowId}
                rowId={rowId}
                inputRef={inputRef}
                captureLocation={captureLocation}
                barcodes={barcodes}
                validateLength={park?.validateBarcodeLength}
                onQueuedChange={setQueued}
              />
            </div>
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
