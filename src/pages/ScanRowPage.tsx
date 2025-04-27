
import React, { useRef, useState, useEffect } from 'react';
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
import { toast } from 'sonner';
import { Barcode, RotateCcw, Edit, Check, X, Loader2, ArrowRight } from 'lucide-react';
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

const NOTIF_SOUND = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAABCxAgAEABAAZGF0YaQAAACAgICAgICAgICAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgAAAAAAAAAA==";

const ScanRowPage = () => {
  const { rowId } = useParams<{ rowId: string }>();
  const { rows, getRowById, getParkById, addBarcode, getBarcodesByRowId, countBarcodesInRow, resetRow, currentUser, updateRow } = useDB();
  const [barcodeInput, setBarcodeInput] = useState('');
  const [success, setSuccess] = useState<boolean | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isEditingRowName, setIsEditingRowName] = useState(false);
  const [rowName, setRowName] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [latestBarcodes, setLatestBarcodes] = useState<any[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const focusInput = () => {
    if (inputRef.current) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  };

  // Load initial barcodes when component mounts or rowId changes
  useEffect(() => {
    if (rowId) {
      const barcodes = getBarcodesByRowId(rowId).slice(-5).reverse();
      setLatestBarcodes(barcodes);
    }
  }, [rowId, getBarcodesByRowId]);

  useEffect(() => {
    focusInput();
  }, []);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!rowId || !rows.some(r => r.id === rowId)) {
    return <Navigate to="/scan" replace />;
  }

  const row = getRowById(rowId);
  const park = row ? getParkById(row.parkId) : undefined;
  const totalBarcodes = countBarcodesInRow(rowId);

  const breadcrumb = park ? `${park.name} / ${row?.name}` : row?.name;

  const registerBarcode = async () => {
    if (!barcodeInput.trim() || isProcessing) return;
    
    try {
      setIsProcessing(true);
      
      // Check for duplicates in the current row
      const duplicates = getBarcodesByRowId(rowId).filter(b => 
        b.code.toLowerCase() === barcodeInput.trim().toLowerCase()
      );

      if (duplicates.length > 0) {
        toast.error('Duplicate barcode detected');
        setBarcodeInput('');
        focusInput();
        return;
      }
      
      const result = await addBarcode(barcodeInput.trim(), rowId);
      
      if (result !== undefined && result !== null) {
        setBarcodeInput('');
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play();
        }
        toast.success('Barcode added successfully');
        
        // Update latest barcodes list with most recent at the top
        const updatedBarcodes = getBarcodesByRowId(rowId).slice(-10).reverse();
        setLatestBarcodes(updatedBarcodes);
      } else {
        toast.error('Failed to add barcode');
      }
    } catch (error) {
      console.error("Error registering barcode:", error);
      toast.error("Failed to add barcode");
    } finally {
      setIsProcessing(false);
      focusInput();
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
    setIsResetting(true);
    try {
      await resetRow(rowId);
      // Update latest barcodes after reset
      setLatestBarcodes([]);
      setIsResetDialogOpen(false);
      toast.success('Row reset successfully');
    } finally {
      setIsResetting(false);
      focusInput();
    }
  };
  
  const startEditingName = () => {
    if (row) {
      setRowName(row.name);
      setIsEditingRowName(true);
    }
  };
  
  const saveRowName = async () => {
    if (row && rowName.trim()) {
      const result = await updateRow(rowId, rowName);
      if (result !== undefined && result !== null) {
        toast.success("Row name updated successfully");
        setIsEditingRowName(false);
      } else {
        toast.error("Failed to update row name");
      }
    } else {
      toast.error("Row name cannot be empty");
    }
    focusInput();
  };

  const cancelEditName = () => {
    setIsEditingRowName(false);
    focusInput();
  };

  const titleContent = isEditingRowName ? (
    <div className="flex items-center space-x-2">
      <Input
        value={rowName}
        onChange={(e) => setRowName(e.target.value)}
        className="w-40 bg-white text-gray-900 border-gray-300"
        autoFocus
      />
      <Button variant="ghost" size="icon" onClick={saveRowName}>
        <Check className="h-4 w-4 text-green-500" />
      </Button>
      <Button variant="ghost" size="icon" onClick={cancelEditName}>
        <X className="h-4 w-4 text-red-500" />
      </Button>
    </div>
  ) : (
    <div className="flex items-center space-x-2">
      <span>{breadcrumb || 'Scan Barcode'}</span>
      <Button variant="ghost" size="icon" onClick={startEditingName}>
        <Edit className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );

  return (
    <AuthGuard>
      <Layout title={breadcrumb || 'Scan Barcode'} showBack titleAction={titleContent}>
        <Card className="glass-card">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center">
                <Barcode className="mr-2 h-5 w-5 text-inventory-primary" />
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
                  className="text-inventory-secondary hover:bg-inventory-secondary/10 border-inventory-secondary/30"
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <CardDescription>
              Scan or enter a barcode to add it to this row
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="relative">
                <Input
                  ref={inputRef}
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Scan or enter barcode"
                  className="text-lg bg-white/80 backdrop-blur-sm border-inventory-secondary/30 pr-[120px]"
                  autoComplete="off"
                />
                <Button 
                  type="submit" 
                  disabled={!barcodeInput.trim() || isProcessing}
                  className="absolute right-0 top-0 bg-inventory-primary hover:bg-inventory-primary/90"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing
                    </>
                  ) : (
                    <>
                      Add Barcode
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
              <audio ref={audioRef} src={NOTIF_SOUND} />
              {latestBarcodes.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Recent Scans</h3>
                  <div className="space-y-1">
                    {latestBarcodes.map((barcode, index) => (
                      <div 
                        key={barcode.id} 
                        className={`text-sm ${index === 0 ? 'text-foreground font-medium animate-in fade-in slide-in-from-bottom-2' : 'text-muted-foreground'}`}
                      >
                        {barcode.code}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
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
              <AlertDialogCancel onClick={focusInput}>Cancel</AlertDialogCancel>
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
