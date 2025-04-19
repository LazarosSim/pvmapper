
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/layout';
import { useDB } from '@/lib/db-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Barcode, Plus } from 'lucide-react';

const ScanPage = () => {
  const { parks, getRowsByParkId, addBarcode, addRow } = useDB();
  const [selectedParkId, setSelectedParkId] = useState<string>("");
  const [selectedRowId, setSelectedRowId] = useState<string>("");
  const [barcodeInput, setBarcodeInput] = useState<string>("");
  const [success, setSuccess] = useState<boolean | null>(null);
  const navigate = useNavigate();

  const rows = selectedParkId ? getRowsByParkId(selectedParkId) : [];

  const handleParkChange = (value: string) => {
    setSelectedParkId(value);
    setSelectedRowId("");
  };

  const handleAddRow = async () => {
    if (selectedParkId) {
      const newRow = await addRow(selectedParkId);
      if (newRow) {
        setSelectedRowId(newRow.id);
      }
    }
  };

  const handleBarcodeSubmit = async () => {
    if (!selectedRowId || !barcodeInput.trim()) {
      setSuccess(false);
      return;
    }

    const result = await addBarcode(barcodeInput.trim(), selectedRowId);
    setSuccess(!!result);
    
    if (result) {
      setBarcodeInput("");
      setTimeout(() => {
        setSuccess(null);
      }, 2000);
    }
  };

  return (
    <Layout title="Scan Barcode">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Barcode className="mr-2 h-5 w-5 text-inventory-primary" />
            Add Barcode
          </CardTitle>
          <CardDescription>
            Select a location and enter a barcode
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Park</label>
            <Select
              value={selectedParkId}
              onValueChange={handleParkChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a park" />
              </SelectTrigger>
              <SelectContent>
                {parks.length > 0 ? (
                  parks.map((park) => (
                    <SelectItem key={park.id} value={park.id}>
                      {park.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No parks found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Select Row</label>
              {selectedParkId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddRow}
                  className="h-8"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Row
                </Button>
              )}
            </div>
            <Select
              value={selectedRowId}
              onValueChange={setSelectedRowId}
              disabled={!selectedParkId || rows.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a row" />
              </SelectTrigger>
              <SelectContent>
                {rows.length > 0 ? (
                  rows.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    {selectedParkId ? "No rows found" : "Select a park first"}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Enter Barcode</label>
            <Input
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan or enter barcode"
              disabled={!selectedRowId}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          {success !== null && (
            <p className={`text-sm ${success ? "text-green-500" : "text-red-500"}`}>
              {success ? "Barcode added successfully" : "Failed to add barcode"}
            </p>
          )}
          <div className="flex gap-2">
            {selectedRowId && (
              <Button variant="outline" onClick={() => navigate(`/row/${selectedRowId}`)}>
                View Row
              </Button>
            )}
            <Button
              onClick={handleBarcodeSubmit}
              disabled={!selectedRowId || !barcodeInput.trim()}
            >
              Add Barcode
            </Button>
          </div>
        </CardFooter>
      </Card>
      
      {parks.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            No parks found. Create your first park to get started.
          </p>
          <Button onClick={() => navigate("/")}>
            Go to Parks
          </Button>
        </div>
      )}
    </Layout>
  );
};

export default ScanPage;
