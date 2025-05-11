
import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowRight, X } from 'lucide-react';
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
  const {
    addBarcode,
    getRowById,
    getParkById,
    getBarcodesByRowId,
    countBarcodesInRow
  } = useDB();
  const {
    playSuccessSound,
    playErrorSound
  } = useSoundEffects();
  const inputRef = useRef<HTMLInputElement>(null);

  // Get the row and check if this is the first barcode
  const row = getRowById(rowId);
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
  
  const registerBarcode = async () => {
    if (!barcodeInput.trim() || isProcessing) return;
    try {
      setIsProcessing(true);
      const row = getRowById(rowId);
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

      // Check if the row has reached its expected barcode limit
      if (row?.expectedBarcodes !== undefined && row.expectedBarcodes !== null) {
        const currentCount = row.currentBarcodes || 0;
        if (currentCount >= row.expectedBarcodes) {
          playErrorSound();
          toast.error(`Maximum barcode limit reached (${row.expectedBarcodes}). Cannot add more barcodes to this row.`);
          setBarcodeInput('');
          focusInput();
          return;
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
      const duplicates = getBarcodesByRowId(rowId).filter(b => b.code.toLowerCase() === barcodeInput.trim().toLowerCase());
      if (duplicates.length > 0) {
        playErrorSound();
        toast.error('Duplicate barcode detected');
        setBarcodeInput('');
        focusInput();
        return;
      }

      // Pass the location data to the addBarcode function
      const result = await addBarcode(barcodeInput.trim(), rowId, undefined, location);
      if (result !== undefined && result !== null) {
        setBarcodeInput('');
        playSuccessSound();
        
        // Show success message with location info if captured
        if (location && isFirstBarcode) {
          toast.success(`Barcode added with GPS location: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
        } else {
          toast.success('Barcode added successfully');
        }

        // Call onBarcodeAdded with the result to update the UI immediately
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

      // We bypass validation for this special code
      const result = await addBarcode(placeholderCode, rowId, undefined, location);
      if (result !== undefined && result !== null) {
        playSuccessSound();
        
        // Show success message with location info if captured
        if (location && isFirstBarcode) {
          toast.success(`Placeholder added with GPS location: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
        } else {
          toast.success('Placeholder added');
        }
        
        // Make sure to update parent component
        onBarcodeAdded(result);
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
          registerBarcode();
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
