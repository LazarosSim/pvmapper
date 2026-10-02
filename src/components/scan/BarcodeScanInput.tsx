import React, {useRef, useState} from 'react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {ArrowRight, CheckCircle2, Loader2, MapPin, X, XCircle} from 'lucide-react';
import useSoundEffects from '@/hooks/use-sound-effects';
import {useSupabase} from "@/lib/supabase-provider";
import {normalizeCode} from '@/lib/scan-rules';
import {addScan, checkScan} from '@/lib/local/repo';

const REJECTED: Record<'duplicate' | 'length' | 'unknown-row', string> = {
  duplicate: 'Duplicate barcode detected',
  length: 'Barcode must be between 19 and 26 digits',
  'unknown-row': 'This row is not on this phone yet. Connect once to download it.',
};

interface BarcodeScanInputProps {
  rowId: string;
  inputRef: React.RefObject<HTMLInputElement>;
  captureLocation: boolean;
}

type Location = { latitude: number; longitude: number };

const getLocation = () =>
  new Promise<Location | null>((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  });

type LastResult = { ok: boolean; text: string; gps?: boolean };

const BarcodeScanInput: React.FC<BarcodeScanInputProps> = ({
  rowId,
  inputRef,
  captureLocation,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [last, setLast] = useState<LastResult | null>(null);
  const [scansInProgress, setScansInProgress] = useState(0);
  const {
    playSuccessSound,
    playErrorSound
  } = useSoundEffects();
  const { user } = useSupabase();

  // Scans are processed one at a time, in the order they were made; the phone's
  // database applies the rules and picks the position inside one transaction.
  const captureRef = useRef(captureLocation);
  captureRef.current = captureLocation;
  const scanQueue = useRef<Promise<void>>(Promise.resolve());

  const focusInput = () => inputRef.current?.focus();

  const reject = (message: string) => {
    playErrorSound();
    toast.error(message);
    setLast({ ok: false, text: message });
  };

  const processScan = async (scannedCode: string, isPlaceholder: boolean) => {
    const check = await checkScan(rowId, scannedCode, isPlaceholder);
    if (check.ok === false) {
      reject(REJECTED[(check as { reason: keyof typeof REJECTED }).reason]);
      return;
    }

    // Capture GPS location only for the first barcode in the row, when location capture is enabled
    let location = null;
    if (check.isFirstInRow && captureRef.current) {
      location = await getLocation();
      if (!location) {
        // The scan is saved anyway
        toast.warning('No GPS location for this row. Check that location is on.');
      }
    }

    const result = await addScan({
      rowId,
      code: scannedCode,
      userId: user?.id ?? '',
      isPlaceholder,
      latitude: location?.latitude,
      longitude: location?.longitude,
    });
    if (result.ok === false) {
      reject(REJECTED[(result as { reason: keyof typeof REJECTED }).reason]);
      return;
    }

    playSuccessSound();
    setLast({ ok: true, text: isPlaceholder ? 'Placeholder added' : `${scannedCode} added`, gps: !!location });
    if (result.alsoInRows.length > 0) {
      toast.warning(`${result.barcode.code} is also in ${result.alsoInRows.join(', ')}`);
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
        reject(isPlaceholder ? "Failed to add placeholder" : "Failed to add barcode");
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

      {last && (
        <p
          role="status"
          className={`mt-2 flex items-center gap-2 text-sm font-medium ${last.ok ? 'text-green-700' : 'text-destructive'}`}
        >
          {last.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
          <span className="truncate">{last.text}</span>
          {last.gps && <MapPin className="h-4 w-4 shrink-0" aria-label="with GPS location" />}
        </p>
      )}
    </form>;
};

export default BarcodeScanInput;
