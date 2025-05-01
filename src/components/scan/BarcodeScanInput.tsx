
import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowRight } from 'lucide-react';
import useSoundEffects from '@/hooks/use-sound-effects';
import { useDB } from '@/lib/db-provider';

interface BarcodeScanInputProps {
  rowId: string;
  onBarcodeAdded: (barcode: any) => void;
  focusInput: () => void;
}

const BarcodeScanInput: React.FC<BarcodeScanInputProps> = ({
  rowId,
  onBarcodeAdded,
  focusInput
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { addBarcode, getRowById, getParkById, getBarcodesByRowId, countBarcodesInRow } = useDB();
  const { playSuccessSound, playErrorSound } = useSoundEffects();
  const inputRef = useRef<HTMLInputElement>(null);

  const registerBarcode = async () => {
    if (!barcodeInput.trim() || isProcessing) return;
    
    try {
      setIsProcessing(true);
      
      const row = getRowById(rowId);
      const park = row ? getParkById(row.parkId) : undefined;
      
      // Check if the row has reached its expected barcode limit
      if (row?.expectedBarcodes !== undefined && row.expectedBarcodes !== null) {
        const currentCount = countBarcodesInRow(rowId);
        if (currentCount >= row.expectedBarcodes) {
          playErrorSound();
          toast.error(`Maximum barcode limit reached (${row.expectedBarcodes}). Cannot add more barcodes to this row.`);
          setBarcodeInput('');
          focusInput();
          return;
        }
      }
      
      if (park?.validateBarcodeLength) {
        const length = barcodeInput.trim().length;
        if (length < 19 || length > 26) {
          playErrorSound();
          toast.error('Barcode must be between 19 and 26 digits');
          setBarcodeInput('');
          focusInput();
          return;
        }
      }
      
      const duplicates = getBarcodesByRowId(rowId).filter(b => 
        b.code.toLowerCase() === barcodeInput.trim().toLowerCase()
      );

      if (duplicates.length > 0) {
        playErrorSound();
        toast.error('Duplicate barcode detected');
        setBarcodeInput('');
        focusInput();
        return;
      }
      
      const result = await addBarcode(barcodeInput.trim(), rowId);
      
      if (result !== undefined && result !== null) {
        setBarcodeInput('');
        playSuccessSound();
        toast.success('Barcode added successfully');
        
        onBarcodeAdded(result);
      } else {
        playErrorSound();
        toast.error('Failed to add barcode');
      }
    } catch (error) {
      console.error("Error registering barcode:", error);
      playErrorSound();
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

  return (
    <form onSubmit={handleSubmit}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={barcodeInput}
          onChange={(e) => setBarcodeInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              registerBarcode();
            }
          }}
          placeholder="Scan or enter barcode"
          className="text-lg bg-white/80 backdrop-blur-sm border-inventory-secondary/30 pr-16"
          autoComplete="off"
        />
        <Button 
          type="submit" 
          disabled={!barcodeInput.trim() || isProcessing}
          className="absolute right-0 top-0 bg-inventory-primary hover:bg-inventory-primary/90 h-full px-3 text-sm"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span className="flex items-center">
              <span className="hidden sm:inline mr-1">Add</span>
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </div>
    </form>
  );
};

export default BarcodeScanInput;
