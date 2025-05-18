
import React, { useState } from 'react';
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

  // Process row names from text area
  const getRowPreviews = (): RowPreview[] => {
    if (activeTab === "single") {
      return rowName ? [{ 
        name: rowName, 
        expectedBarcodes: expectedBarcodes ? parseInt(expectedBarcodes) : undefined 
      }] : [];
    }

    const names = rowNamesText
      .split('\n')
      .map(name => name.trim())
      .filter(name => name !== '');
    
    return names.map(name => {
      const barcodeCount = applyToAll 
        ? (expectedBarcodes ? parseInt(expectedBarcodes) : undefined)
        : (individualBarcodeCount[name] ? parseInt(individualBarcodeCount[name]) : undefined);
      
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
          const expectedBarcodesValue = preview.expectedBarcodes;
          
          // For bulk creation, set navigate to false to avoid redirecting
          // We'll only navigate after all rows are created
          const result = await addRow(parkId, expectedBarcodesValue, false);
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
                placeholder="Enter each row name on a new line, e.g.:
Row A
Row B
Row C"
                className="min-h-[120px]"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="apply-to-all"
                checked={applyToAll}
                onCheckedChange={setApplyToAll}
              />
              <Label htmlFor="apply-to-all">Apply same barcode count to all rows</Label>
            </div>

            {applyToAll && (
              <div className="space-y-2">
                <Label htmlFor="bulk-expected-barcodes">Expected Barcodes (all rows)</Label>
                <Input
                  id="bulk-expected-barcodes"
                  type="number"
                  min="0"
                  value={expectedBarcodes}
                  onChange={(e) => setExpectedBarcodes(e.target.value)}
                  placeholder="Leave empty for unlimited"
                  className="w-full"
                />
              </div>
            )}

            {rowPreviews.length > 0 && (
              <div className="space-y-2 mt-4">
                <h3 className="text-sm font-medium">Rows to create ({rowPreviews.length}):</h3>
                <div className="max-h-[200px] overflow-y-auto border rounded-md p-2">
                  {rowPreviews.map((preview, index) => (
                    <div key={index} className="flex items-center justify-between py-1 border-b last:border-b-0">
                      <span className="text-sm">{preview.name}</span>
                      {!applyToAll && (
                        <Input
                          type="number"
                          min="0"
                          value={individualBarcodeCount[preview.name] || ''}
                          onChange={(e) => handleRowNameChange(preview.name, e.target.value)}
                          placeholder="Barcodes"
                          className="w-24 text-xs h-8"
                        />
                      )}
                      {applyToAll && expectedBarcodes && (
                        <span className="text-xs text-muted-foreground">{expectedBarcodes} barcodes</span>
                      )}
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
