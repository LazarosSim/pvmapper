
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
import { Barcode } from 'lucide-react';

// Louder and longer Mario Coin sound (base64 encoded)
const NOTIF_SOUND = 
  "data:audio/wav;base64,UklGRuQEAABXQVZFZm10IBAAAAABAAEARKwAABCxAgAEABAAZGF0YZAAAAD/IwCEQDAgBYQ0tDyEPbQ8tDuEO7Q6RDpEOIQ3RDeENoQ3hDaEN4Q2hDaENYQ1hDWENYQ1hDWENIQ0hDOEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQyhDKEMoQy";

const ScanRowPage: React.FC = () => {
  const { rowId } = useParams<{ rowId: string }>();
  const { getBarcodesByRowId, addBarcode, getRowById } = useDB();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  if (!rowId) {
    return <Navigate to="/scan" />;
  }

  const row = getRowById(rowId);
  if (!row) {
    return <Navigate to="/scan" />;
  }

  const existingBarcodes = getBarcodesByRowId(rowId);
  const currentCount = existingBarcodes.length;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!input.trim()) {
      setError('Please enter a barcode');
      return;
    }

    const result = await addBarcode(input.trim(), rowId);
    if (result) {
      // Play notification sound
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.error('Error playing sound:', e));
      }
      setInput('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Layout
      title={`Scan ${row.name}`}
      back={`/row/${rowId}`}
      showScan={false}
    >
      <audio ref={audioRef} src={NOTIF_SOUND} />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Scan Barcodes</CardTitle>
            <CardDescription>
              Scan barcodes for {row.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label htmlFor="barcode" className="text-sm font-medium">
                  Barcode
                </label>
                <div className="flex space-x-2 mt-1">
                  <Input
                    id="barcode"
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter or scan barcode"
                    className="flex-1"
                    autoFocus
                  />
                  <Button onClick={handleSubmit}>
                    <Barcode className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </div>
                {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
              </div>

              <div className="bg-slate-100 p-3 rounded-md">
                <p className="font-medium">Current count: {currentCount}</p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <p className="text-sm text-gray-500">
              Press Enter after each scan to register the barcode
            </p>
          </CardFooter>
        </Card>
      </div>
    </Layout>
  );
};

export default ScanRowPage;
