
import React, { useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import Layout from '@/components/layout/layout';
import { useDB } from '@/lib/db-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Barcode, RotateCcw } from 'lucide-react';
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
import AuthGuard from '@/components/auth/auth-guard';

const NOTIF_SOUND =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAABCxAgAEABAAZGF0YaQAAACAgICAgICAgICAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgAAAAAAAAAA==";

const ScanRowPage = () => {
  const { rowId } = useParams<{ rowId: string }>();
  const { rows, getRowById, getParkById, addBarcode, getBarcodesByRowId, countBarcodesInRow, resetRow, currentUser } = useDB();
  const [barcodeInput, setBarcodeInput] = useState('');
  const [success, setSuccess] = useState<boolean | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!rowId || !rows.some(r => r.id === rowId)) {
    return <Navigate to="/scan" replace />;
  }

  const row = getRowById(rowId);
  const park = row ? getParkById(row.parkId) : undefined;
  const recentBarcodes = getBarcodesByRowId(rowId).slice(-5).reverse();
  const totalBarcodes = countBarcodesInRow(rowId);

  const breadcrumb = park ? `${park.name} / ${row?.name}` : row?.name;

  const registerBarcode = async () => {
    if (!barcodeInput.trim()) return;
    const result = await addBarcode(barcodeInput.trim(), rowId);
    setSuccess(!!result);

    if (result) {
      setBarcodeInput('');
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
      setTimeout(() => {
        setSuccess(null);
      }, 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await registerBarcode();
  };

  const handleInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await registerBarcode();
    }
  };

  const handleReset = async () => {
    await resetRow(rowId);
    setIsResetDialogOpen(false);
  };

  const dailyScans = currentUser ? currentUser.id : 0;

  return (
    <AuthGuard>
      <Layout title={breadcrumb || 'Scan Barcode'} showBack>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center">
                <Barcode className="mr-2 h-5 w-5 text-primary" />
                Scan Barcode
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium bg-secondary px-3 py-1 rounded-full">
                  {totalBarcodes} barcodes
                </span>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setIsResetDialogOpen(true)}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardDescription>
              Scan or enter a barcode to add it to this row
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  ref={inputRef}
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Scan or enter barcode"
                  className="text-lg"
                  autoFocus
                />
                <audio ref={audioRef} src={NOTIF_SOUND} />
              </div>
              {recentBarcodes.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Recent Scans</h3>
                  <div className="space-y-1">
                    {recentBarcodes.map(barcode => (
                      <div key={barcode.id} className="text-sm text-muted-foreground">
                        {barcode.code}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-between">
              {success !== null && (
                <p className={`text-sm ${success ? "text-green-500" : "text-red-500"}`}>
                  {success ? "Barcode added successfully" : "Failed to add barcode"}
                </p>
              )}
              <Button type="submit" disabled={!barcodeInput.trim()}>
                Add Barcode
              </Button>
            </CardFooter>
          </form>
        </Card>

        <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete all your scanned barcodes in this row. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground">
                Reset Row
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Layout>
    </AuthGuard>
  );
};

export default ScanRowPage;
