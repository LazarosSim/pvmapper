
import React, { useState } from 'react';
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

const ScanRowPage = () => {
  const { rowId } = useParams<{ rowId: string }>();
  const { rows, getRowById, getParkById, addBarcode, getBarcodesByRowId } = useDB();
  const [barcodeInput, setBarcodeInput] = useState('');
  const [success, setSuccess] = useState<boolean | null>(null);

  if (!rowId || !rows.some(r => r.id === rowId)) {
    return <Navigate to="/scan" replace />;
  }

  const row = getRowById(rowId);
  const park = row ? getParkById(row.parkId) : undefined;
  const recentBarcodes = getBarcodesByRowId(rowId).slice(-5).reverse();
  
  const breadcrumb = park ? `${park.name} / ${row?.name}` : row?.name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const result = await addBarcode(barcodeInput.trim(), rowId);
    setSuccess(!!result);
    
    if (result) {
      setBarcodeInput('');
      setTimeout(() => {
        setSuccess(null);
      }, 2000);
    }
  };

  return (
    <Layout title={breadcrumb || 'Scan Barcode'} showBack>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Barcode className="mr-2 h-5 w-5 text-inventory-primary" />
            Scan Barcode
          </CardTitle>
          <CardDescription>
            Scan or enter a barcode to add it to this row
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan or enter barcode"
                className="text-lg"
                autoFocus
              />
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
    </Layout>
  );
};

export default ScanRowPage;
