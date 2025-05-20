
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { useDB } from '@/lib/db-provider';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";

interface BulkRowsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parkId: string;
}

interface RowPreview {
  name: string;
  expectedBarcodes?: number;
}

const BulkRowsDialog = ({ open, onOpenChange, parkId }: BulkRowsDialogProps) => {
  const { addRow, rows } = useDB();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");
  const [rowName, setRowName] = useState('');
  const [rowNamesText, setRowNamesText] = useState('');
  const [expectedBarcodes, setExpectedBarcodes] = useState<string>('');
  const [applyToAll, setApplyToAll] = useState(true);
  const [individualBarcodeCount, setIndividualBarcodeCount] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Process row names from text area (with new comma parsing)
  const getRowPreviews = (): RowPreview[] => {
    if (activeTab === "single") {
      return rowName ? [{ 
        name: rowName, 
        expectedBarcodes: expectedBarcodes ? parseInt(expectedBarcodes) : undefined 
      }] : [];
    }

    // Process bulk entries
    const entries = rowNamesText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '');
    
    return entries.map(entry => {
      // Split by comma to extract name and expected barcode count
      const parts = entry.split(',');
      const name = parts[0].trim();
      
      let barcodeCount: number | undefined = undefined;
      
      // If comma exists and there's a value after it, parse that as barcode count
      if (parts.length > 1 && parts[1].trim() !== '') {
        const parsedCount = parseInt(parts[1].trim());
        if (!isNaN(parsedCount)) {
          barcodeCount = parsedCount;
        }
      } else if (applyToAll && expectedBarcodes) {
        // If applying to all and we have a global count
        barcodeCount = parseInt(expectedBarcodes);
      } else if (individualBarcodeCount[name]) {
        // Fallback to individually set counts (from UI)
        barcodeCount = parseInt(individualBarcodeCount[name]);
      }
      
      return {
        name,
        expectedBarcodes: barcodeCount
      };
    });
  };

  const handleRowNameChange = (name: string, count: string) => {
    setIndividualBarcodeCount(prev => ({
      ...prev,
      [name]: count
    }));
  };

  const handleSubmit = async () => {
    const previews = getRowPreviews();
    if (previews.length === 0) {
      toast.error("Please enter at least one row name");
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;

    try {
      if (activeTab === "single") {
        // Single row creation
        const expectedBarcodesValue = expectedBarcodes ? parseInt(expectedBarcodes) : undefined;
        const result = await addRow(parkId, expectedBarcodesValue);
        if (result) {
          toast.success(`Row created successfully`);
          onOpenChange(false);
        }
      } else {
        // Bulk row creation
        // Use sequential creation to maintain proper row ordering
        for (const preview of previews) {
          // Use the custom name from the preview
          const result = await addRow(
            parkId, 
            preview.expectedBarcodes,
            false, // Don't navigate
            preview.name // Pass custom row name
          );
          
          if (result) {
            successCount++;
          }
        }

        if (successCount > 0) {
          toast.success(`Created ${successCount} of ${previews.length} rows successfully`);
          onOpenChange(false);
        } else {
          toast.error("Failed to create any rows");
        }
      }
    } catch (error) {
      console.error("Error creating rows:", error);
      toast.error("An error occurred while creating rows");
    } finally {
      setIsSubmitting(false);
      
      // Reset form
      setRowName('');
      setRowNamesText('');
      setExpectedBarcodes('');
      setIndividualBarcodeCount({});
    }
  };

  const rowPreviews = getRowPreviews();

  // Example text for the textarea placeholder
  const placeholderText = `Enter each row name on a new line.
Add a comma and a number for expected barcodes:
Row A, 10
Row B, 20
Row C`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Rows</DialogTitle>
          <DialogDescription>
            Create new rows in this park. You can add a single row or bulk add multiple rows.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "single" | "bulk")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">Single Row</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Add</TabsTrigger>
          </TabsList>
          
          <TabsContent value="single" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="expected-barcodes">Expected Barcodes</Label>
              <Input
                id="expected-barcodes"
                type="number"
                min="0"
                value={expectedBarcodes}
                onChange={(e) => setExpectedBarcodes(e.target.value)}
                placeholder="Leave empty for unlimited"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Set the maximum number of barcodes for this row. Leave empty for unlimited.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="bulk" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="row-names">Row Names (one per line)</Label>
              <Textarea
                id="row-names"
                value={rowNamesText}
                onChange={(e) => setRowNamesText(e.target.value)}
                placeholder={placeholderText}
                className="min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground">
                For each row, you can specify expected barcodes by adding a comma and a number.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="apply-to-all"
                checked={applyToAll}
                onCheckedChange={setApplyToAll}
              />
              <Label htmlFor="apply-to-all">
                Apply same barcode count to rows without specified counts
              </Label>
            </div>

            {applyToAll && (
              <div className="space-y-2">
                <Label htmlFor="bulk-expected-barcodes">Default Expected Barcodes</Label>
                <Input
                  id="bulk-expected-barcodes"
                  type="number"
                  min="0"
                  value={expectedBarcodes}
                  onChange={(e) => setExpectedBarcodes(e.target.value)}
                  placeholder="Leave empty for unlimited"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Applied to rows that don't have a specific count after the comma.
                </p>
              </div>
            )}

            {rowPreviews.length > 0 && (
              <div className="space-y-2 mt-4">
                <h3 className="text-sm font-medium">Rows to create ({rowPreviews.length}):</h3>
                <div className="max-h-[200px] overflow-y-auto border rounded-md p-2">
                  {rowPreviews.map((preview, index) => (
                    <div key={index} className="flex items-center justify-between py-1 border-b last:border-b-0">
                      <span className="text-sm">{preview.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {preview.expectedBarcodes !== undefined 
                          ? `${preview.expectedBarcodes} barcodes`
                          : 'Unlimited'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting || 
              (activeTab === "single" && !rowName && !expectedBarcodes) || 
              (activeTab === "bulk" && rowPreviews.length === 0)
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              `Create ${rowPreviews.length > 1 ? `${rowPreviews.length} Rows` : 'Row'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkRowsDialog;
