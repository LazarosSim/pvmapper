import React, {useEffect, useRef, useState} from 'react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {ArrowRight, X} from 'lucide-react';
import useSoundEffects from '@/hooks/use-sound-effects';
import {useSupabase} from "@/lib/supabase-provider";
import {hasValidLength, isDuplicateCode, normalizeCode} from '@/lib/scan-rules';
import {addScan} from '@/lib/local/repo';

const REJECTED: Record<'duplicate' | 'length' | 'unknown-row', string> = {
  duplicate: 'Duplicate barcode detected',
  length: 'Barcode must be between 19 and 26 digits',
  'unknown-row': 'This row is not on this phone yet. Connect once to download it.',
};

/** A scan that passed the checks and is on its way to the phone's database. */
export type QueuedScan = { id: string; code: string; timestamp: string };

interface BarcodeScanInputProps {
  rowId: string;
  inputRef: React.RefObject<HTMLInputElement>;
  captureLocation: boolean;
  /** The row's saved barcodes, for the instant duplicate check */
  barcodes?: ReadonlyArray<{ id: string; code: string }>;
  /** The park's length rule */
  validateLength?: boolean;
  /** Scans accepted but not saved yet, so the page can count and list them right away */
  onQueuedChange?: (scans: QueuedScan[]) => void;
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

const BarcodeScanInput: React.FC<BarcodeScanInputProps> = ({
  rowId,
  inputRef,
  captureLocation,
  barcodes,
  validateLength = false,
  onQueuedChange,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const {
    playSuccessSound,
    playErrorSound
  } = useSoundEffects();
  const { user } = useSupabase();

  // A scanner can send the next code before the last one is saved, so the checks run on
  // what is in memory: the saved barcodes plus the scans accepted since.
  const captureRef = useRef(captureLocation);
  captureRef.current = captureLocation;
  const barcodesRef = useRef(barcodes);
  barcodesRef.current = barcodes;
  const queuedRef = useRef<QueuedScan[]>([]);
  const [queued, setQueued] = useState<QueuedScan[]>([]);
  const updateQueued = (change: (scans: QueuedScan[]) => QueuedScan[]) => {
    queuedRef.current = change(queuedRef.current);
    setQueued(queuedRef.current);
  };
  // Saves run one at a time, in the order of the scans
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    onQueuedChange?.(queued);
  }, [queued, onQueuedChange]);

  // A queued scan is dropped once the saved barcodes include it, so the count never dips
  useEffect(() => {
    if (!barcodes) return;
    const saved = new Set(barcodes.map((b) => b.id));
    if (queuedRef.current.some((scan) => saved.has(scan.id))) {
      updateQueued((scans) => scans.filter((scan) => !saved.has(scan.id)));
    }
  }, [barcodes]);

  const focusInput = () => inputRef.current?.focus();

  const reject = (message: string) => {
    playErrorSound();
    toast.error(message);
  };

  const drop = (id: string) => updateQueued((scans) => scans.filter((scan) => scan.id !== id));

  const save = async (scan: QueuedScan, isPlaceholder: boolean, isFirstInRow: boolean) => {
    // Capture GPS location only for the first barcode in the row, when location capture is enabled
    let location = null;
    if (isFirstInRow && captureRef.current) {
      location = await getLocation();
      if (!location) {
        // The scan is saved anyway
        toast.warning('No GPS location for this row. Check that location is on.');
      }
    }

    const result = await addScan({
      id: scan.id,
      timestamp: scan.timestamp,
      rowId,
      code: scan.code,
      userId: user?.id ?? '',
      isPlaceholder,
      latitude: location?.latitude,
      longitude: location?.longitude,
    });
    if (result.ok === false) {
      // Rare: the database knew something memory didn't (e.g. a change from another screen)
      drop(scan.id);
      reject(REJECTED[(result as { reason: keyof typeof REJECTED }).reason]);
      return;
    }
    if (!barcodesRef.current) drop(scan.id);
    if (result.alsoInRows.length > 0) {
      toast.warning(`${result.barcode.code} is also in ${result.alsoInRows.join(', ')}`);
    }
  };

  // The sound plays as soon as the scan passes the checks: the worker moves on while it is
  // saved and uploaded in the background.
  const queueScan = (rawCode: string, isPlaceholder = false) => {
    const code = normalizeCode(rawCode);
    if (!code && !isPlaceholder) return;

    if (!isPlaceholder) {
      if (validateLength && !hasValidLength(code)) return reject(REJECTED.length);
      const known = [...(barcodesRef.current ?? []), ...queuedRef.current].map((b) => b.code);
      if (isDuplicateCode(code, known)) return reject(REJECTED.duplicate);
    }

    const isFirstInRow = barcodesRef.current?.length === 0 && queuedRef.current.length === 0;
    const timestamp = new Date().toISOString();
    const scan: QueuedScan = {
      id: crypto.randomUUID(),
      code: isPlaceholder ? `X_PLACEHOLDER_${timestamp}` : code,
      timestamp,
    };
    updateQueued((scans) => [...scans, scan]);
    playSuccessSound();

    saveQueue.current = saveQueue.current
      .then(() => save(scan, isPlaceholder, isFirstInRow))
      .catch((error) => {
        console.error(isPlaceholder ? "Error adding placeholder:" : "Error registering barcode:", error);
        drop(scan.id);
        reject(isPlaceholder ? "Failed to add placeholder" : "Failed to add barcode");
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
          <span className="flex items-center">
            <span className="hidden sm:inline mr-1">Add</span>
            <ArrowRight className="h-4 w-4" />
          </span>
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
