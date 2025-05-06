
import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowRight, X, MapPin } from 'lucide-react';
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
  const [captureLocation, setCaptureLocation] = useState(false);
  const { addBarcode, getRowById, getParkById, getBarcodesByRowId, countBarcodesInRow } = useDB();
  const { playSuccessSound, playErrorSound } = useSoundEffects();
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if this is the first barcode in the row
  const isFirstBarcode = countBarcodesInRow(rowId) === 0;

  const captureGPSLocation = async (): Promise<{latitude: number, longitude: number} | null> => {
    try {
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
      
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
    } catch (error) {
      console.error("Error getting location:", error);
      toast.error("Unable to get location. Please ensure location services are enabled.");
      return null;
    }
  };

  const registerBarcode = async () => {
    if (!barcodeInput.trim() || isProcessing) return;
    
    try {
      setIsProcessing(true);
      
      const row = getRowById(rowId);
      const park = row ? getParkById(row.parkId) : undefined;
      
      // Capture GPS location only if this is the first barcode in the row and location capture is enabled
      let location = null;
      if (isFirstBarcode && captureLocation) {
        toast.loading("Capturing location...");
        location = await captureGPSLocation();
        if (!location) {
          // Allow the user to continue even if location capture fails
          toast.dismiss();
          toast.warning("Location capture failed, but proceeding with barcode registration");
        } else {
          toast.dismiss();
          toast.success("Location captured successfully");
        }
      }
      
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
      
      // Pass the location data to the addBarcode function
      const result = await addBarcode(barcodeInput.trim(), rowId, undefined, location);
      
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

  const registerPlaceholder = async () => {
    try {
      setIsProcessing(true);
      
      // Generate unique placeholder barcode with timestamp to avoid duplicates
      const timestamp = new Date().getTime();
      const placeholderCode = `X_PLACEHOLDER_${timestamp}`;
      
      // Capture GPS location if this is the first barcode in the row and location capture is enabled
      let location = null;
      if (isFirstBarcode && captureLocation) {
        toast.loading("Capturing location...");
        location = await captureGPSLocation();
        if (!location) {
          toast.dismiss();
          toast.warning("Location capture failed, but proceeding with placeholder");
        } else {
          toast.dismiss();
          toast.success("Location captured successfully");
        }
      }
      
      // We bypass validation for this special code
      const result = await addBarcode(placeholderCode, rowId, undefined, location);
      
      if (result !== undefined && result !== null) {
        playSuccessSound();
        toast.success('Placeholder added');
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

  return (
    <form onSubmit={handleSubmit} className="relative">
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
      
      <div className="absolute right-0 top-0 flex h-full">
        {isFirstBarcode && (
          <Button
            type="button"
            onClick={() => setCaptureLocation(!captureLocation)}
            className={`h-full px-2 mr-1 ${captureLocation ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
            variant="ghost"
            size="icon"
            title={captureLocation ? "GPS location will be captured" : "Click to enable GPS location capture"}
          >
            <MapPin className={`h-4 w-4 ${captureLocation ? 'text-green-600' : 'text-gray-400'}`} />
          </Button>
        )}
        <Button
          type="button"
          onClick={registerPlaceholder}
          disabled={isProcessing}
          className="h-full bg-gray-200 hover:bg-gray-300 px-2 rounded-md text-gray-600 ml-1"
          variant="ghost"
          size="icon"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
};

export default BarcodeScanInput;
