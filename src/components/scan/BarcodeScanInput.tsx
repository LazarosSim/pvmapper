
import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowRight, X } from 'lucide-react';
import useSoundEffects from '@/hooks/use-sound-effects';
import { useDB } from '@/lib/db-provider';
import {useRow} from "@/hooks/use-row-queries.tsx";
import {
  useAddBarcodeToRow,
  useDeleteRowBarcode,
  useResetRowBarcodes, useRowBarcodes,
  useUpdateRowBarcode
} from "@/hooks/use-barcodes-queries.tsx";

interface BarcodeScanInputProps {
  rowId: string;
  focusInput: () => void;
}

const BarcodeScanInput: React.FC<BarcodeScanInputProps> = ({
  rowId,
  focusInput
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const {
    getRowById,
    getParkById,
    getBarcodesByRowId,
  } = useDB();
  const {
    playSuccessSound,
    playErrorSound
  } = useSoundEffects();
  const inputRef = useRef<HTMLInputElement>(null);

  // Get the row and check if this is the first barcode
  const {data: row, isLoading, isError } = useRow(rowId);

  const {mutateAsync: addBarcode} = useAddBarcodeToRow(rowId);
  const {mutate: resetRow, data:affectedRows} = useResetRowBarcodes(rowId);
  const {data: barcodes} = useRowBarcodes(rowId);

  const isFirstBarcode = row?.currentBarcodes === 0;


  const captureGPSLocation = async (): Promise<{
    latitude: number;
    longitude: number;
  } | null> => {
    try {
      toast.loading("Capturing GPS location...");
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          toast.error("Geolocation is not supported by this browser");
          reject("Geolocation not supported");
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
      });
      
      toast.dismiss();
      toast.success("GPS location captured successfully");
      
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
    } catch (error) {
      console.error("Error getting location:", error);
      toast.dismiss();
      toast.error("Unable to get GPS location. Please ensure location services are enabled.");
      return null;
    }
  };
  
  const registerBarcode = async (barcodeCode:string) => {
    if (!barcodeCode || isProcessing) return;
    try {
      setIsProcessing(true);
      const park = row ? getParkById(row.parkId) : undefined;

      // Get the captureLocation state from the parent component through the row
      const captureLocation = row ? (row as any).captureLocation || false : false;

      // Capture GPS location only if this is the first barcode in the row and location capture is enabled
      let location = null;
      if (isFirstBarcode && captureLocation) {
        location = await captureGPSLocation();
        if (!location) {
          // Allow the user to continue even if location capture fails
          toast.warning("GPS location capture failed, but proceeding with barcode registration");
        }
      }
      
      // Apply validation if required by the park
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
      
      // Check for duplicates
      const duplicates = barcodes.filter(b => b.code.toLowerCase() === barcodeInput.toLowerCase());
      if (duplicates.length > 0) {
        playErrorSound();
        toast.error('Duplicate barcode detected');
        setBarcodeInput('');
        focusInput();
        return;
      }

      // Pass the location data to the addBarcode function
      const displayOrder = barcodes[barcodes.length - 1]?.displayOrder + 1000 || 1000;
      await addBarcode({code:barcodeCode, displayOrder});
      setBarcodeInput('');
      playSuccessSound();
      if (location && isFirstBarcode) {
        toast.success(`Barcode added with GPS location: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
      } else {
        toast.success('Barcode added successfully');
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
    console.log('handleSubmit running');
    e.preventDefault();
  };
  
  const registerPlaceholder = async () => {
    try {
      setIsProcessing(true);

      // Generate unique placeholder barcode with timestamp to avoid duplicates
      const timestamp = new Date().getTime();
      const placeholderCode = `X_PLACEHOLDER_${timestamp}`;

      // Get the captureLocation state from the parent component through the row
      const row = getRowById(rowId);
      const captureLocation = row ? (row as any).captureLocation || false : false;

      // Capture GPS location if this is the first barcode in the row and location capture is enabled
      let location = null;
      if (isFirstBarcode && captureLocation) {
        location = await captureGPSLocation();
        if (!location) {
          toast.warning("GPS location capture failed, but proceeding with placeholder");
        }
      }

      const displayOrder = barcodes[barcodes.length - 1]?.displayOrder + 1000 || 1000;
      // We bypass validation for this special code
      const result = addBarcode({code:placeholderCode, displayOrder});
      if (result !== undefined && result !== null) {
        playSuccessSound();
        
        if (location && isFirstBarcode) {
          toast.success(`Placeholder added with GPS location: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
        } else {
          toast.success('Placeholder added');
        }
      } else {
        playErrorSound();
        toast.error('Failed to add placeholder');
      }
    } catch (error) {
      console.error("Error adding placeholder:", error);
      playErrorSound();
      toast.error("Failed to add placeholder");
    } finally {
      setIsProcessing(false);
      focusInput();
    }
  };
  
  return <form onSubmit={handleSubmit} className="relative">
      <div className="relative">
        <Input ref={inputRef} value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} onKeyDown={e => {
        if (e.key === "Enter") {
          e.preventDefault();
          registerBarcode(barcodeInput.trim());
        }
      }} placeholder="Scan or enter barcode" className="text-lg bg-white/80 backdrop-blur-sm border-inventory-secondary/30 pr-16" autoComplete="off" />
        <Button type="submit" disabled={!barcodeInput.trim() || isProcessing} className="absolute right-0 top-0 bg-inventory-primary hover:bg-inventory-primary/90 h-full px-3 text-sm">
          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="flex items-center">
              <span className="hidden sm:inline mr-1">Add</span>
              <ArrowRight className="h-4 w-4" />
            </span>}
        </Button>
      </div>
      
      <div className="absolute right-0 top-0 flex h-full">
        <Button type="button" onClick={registerPlaceholder} disabled={isProcessing} variant="ghost" size="icon" className="h-full rounded-md ml-1 px-[2px] py-[2px] mx-0 my-[40px] text-center text-base bg-gray-400 hover:bg-gray-300 text-zinc-950">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </form>;
};

export default BarcodeScanInput;
