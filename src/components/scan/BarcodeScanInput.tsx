import React, {useRef, useState} from 'react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {ArrowRight, Loader2, X} from 'lucide-react';
import useSoundEffects from '@/hooks/use-sound-effects';
import {useDB} from '@/lib/db-provider';
import {useRow} from "@/hooks/use-row-queries.tsx";
import {useParkById} from "@/hooks/parks";
import {useRowBarcodes} from "@/hooks/use-barcodes-queries.tsx";
import {useOfflineAddBarcode, useMergedBarcodes} from "@/hooks/use-offline-barcodes";
import {useSupabase} from "@/lib/supabase-provider";
import {hasValidLength, isDuplicateCode, nextOrderInRow, normalizeCode} from '@/lib/scan-rules';

interface BarcodeScanInputProps {
  rowId: string;
  inputRef: React.RefObject<HTMLInputElement>;
  captureLocation: boolean;
}

const BarcodeScanInput: React.FC<BarcodeScanInputProps> = ({
  rowId,
  inputRef,
  captureLocation,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scansInProgress, setScansInProgress] = useState(0);
  const {
    getParkById,
  } = useDB();
  const {
    playSuccessSound,
    playErrorSound
  } = useSoundEffects();
  const { user } = useSupabase();

  const {data: row} = useRow(rowId);
  // Cached with the park list, so length validation also applies when the app starts offline
  const {data: park} = useParkById(row?.parkId);

  // Server barcodes
  const {data: serverBarcodes} = useRowBarcodes(rowId);

  // Merged barcodes (server + pending offline)
  const {mergedBarcodes: barcodes} = useMergedBarcodes(rowId, serverBarcodes);

  // Offline-first add barcode
  const {addBarcode} = useOfflineAddBarcode({rowId, userId: user?.id});

  // Scans are processed one at a time, in the order they were made, and may run after
  // the render that queued them: they read the latest values through this ref.
  const latest = useRef({ barcodes, row, park, captureLocation });
  latest.current = { barcodes, row, park, captureLocation };
  // Barcodes saved here that may not have reached `barcodes` yet
  const recentAdds = useRef<{ id: string; code: string; orderInRow: number }[]>([]);
  const scanQueue = useRef<Promise<void>>(Promise.resolve());

  const focusInput = () => inputRef.current?.focus();

  const captureGPSLocation = async (): Promise<{
    latitude: number;
    longitude: number;
  } | null> => {
    const toastId = toast.loading("Capturing GPS location...");
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

      toast.dismiss(toastId);
      toast.success("GPS location captured successfully");

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
    } catch (error) {
      console.error("Error getting location:", error);
      toast.dismiss(toastId);
      toast.error("Unable to get GPS location. Please ensure location services are enabled.");
      return null;
    }
  };

  const processScan = async (scannedCode: string, isPlaceholder: boolean) => {
    const { barcodes, row, park, captureLocation } = latest.current;
    const known = barcodes ?? [];
    const knownIds = new Set(known.map(b => b.id));
    recentAdds.current = recentAdds.current.filter(add => !knownIds.has(add.id));
    const rowBarcodes = [
      ...known.map(b => ({ code: b.code, orderInRow: b.orderInRow })),
      ...recentAdds.current,
    ];

    const timestamp = new Date().toISOString();
    // Placeholders get a unique code so they never count as duplicates
    const code = isPlaceholder ? `X_PLACEHOLDER_${timestamp}` : scannedCode;

    if (!isPlaceholder) {
      // Apply validation if required by the park
      const validateLength = park?.validateBarcodeLength
        ?? (row ? getParkById(row.parkId)?.validateBarcodeLength : false);
      if (validateLength && !hasValidLength(code)) {
        playErrorSound();
        toast.error('Barcode must be between 19 and 26 digits');
        return;
      }

      if (isDuplicateCode(code, rowBarcodes.map(b => b.code))) {
        playErrorSound();
        toast.error('Duplicate barcode detected');
        return;
      }
    }

    // Capture GPS location only for the first barcode in the row, when location capture is enabled
    const isFirstBarcode = rowBarcodes.length === 0;
    let location = null;
    if (isFirstBarcode && captureLocation) {
      location = await captureGPSLocation();
      if (!location) {
        // Allow the user to continue even if location capture fails
        toast.warning(`GPS location capture failed, but proceeding with ${isPlaceholder ? 'placeholder' : 'barcode registration'}`);
      }
    }

    const orderInRow = nextOrderInRow(rowBarcodes.map(b => b.orderInRow));

    // Use offline-first addBarcode
    const mutation = await addBarcode(
      code,
      orderInRow,
      timestamp,
      location?.latitude,
      location?.longitude
    );
    recentAdds.current.push({ id: mutation.id, code, orderInRow });

    playSuccessSound();
    const label = isPlaceholder ? 'Placeholder' : 'Barcode';
    if (location) {
      toast.success(`${label} added with GPS location: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
    } else {
      toast.success(isPlaceholder ? 'Placeholder added' : 'Barcode added successfully');
    }
  };

  // The input is cleared as soon as a scan is submitted, so a scanner can send the
  // next code right away; queued scans are never dropped or merged together.
  const queueScan = (rawCode: string, isPlaceholder = false) => {
    const code = normalizeCode(rawCode);
    if (!code && !isPlaceholder) return;

    setScansInProgress(count => count + 1);
    scanQueue.current = scanQueue.current
      .then(() => processScan(code, isPlaceholder))
      .catch((error) => {
        console.error(isPlaceholder ? "Error adding placeholder:" : "Error registering barcode:", error);
        playErrorSound();
        toast.error(isPlaceholder ? "Failed to add placeholder" : "Failed to add barcode");
      })
      .finally(() => {
        setScansInProgress(count => count - 1);
        focusInput();
      });
  };

  const submitInput = () => {
    queueScan(barcodeInput);
    setBarcodeInput('');
    focusInput();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitInput();
  };

  return <form onSubmit={handleSubmit} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={barcodeInput}
          onChange={e => setBarcodeInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitInput();
            }
          }}
          placeholder="Scan or enter barcode"
          className="text-lg bg-white/80 backdrop-blur-sm border-inventory-secondary/30 pr-16"
          autoComplete="off"
          autoFocus
        />
        <Button type="submit" disabled={!barcodeInput.trim()} className="absolute right-0 top-0 bg-inventory-primary hover:bg-inventory-primary/90 h-full px-3 text-sm">
          {scansInProgress > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="flex items-center">
              <span className="hidden sm:inline mr-1">Add</span>
              <ArrowRight className="h-4 w-4" />
            </span>}
        </Button>
      </div>

      <div className="absolute right-0 top-0 flex h-full">
        {/* Never takes focus: a scanner's Enter must go to the input, not re-press this button */}
        <Button
          type="button"
          tabIndex={-1}
          onMouseDown={e => e.preventDefault()}
          onClick={() => queueScan('', true)}
          variant="ghost"
          size="icon"
          title="Add placeholder for a missing or unreadable panel"
          aria-label="Add placeholder for a missing or unreadable panel"
          className="h-full rounded-md ml-1 px-[2px] py-[2px] mx-0 my-[40px] text-center text-base bg-gray-400 hover:bg-gray-300 text-zinc-950"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </form>;
};

export default BarcodeScanInput;
