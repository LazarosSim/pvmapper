import React, {useState} from 'react';
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,} from "@/components/ui/dialog";
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {MapPin} from 'lucide-react';
import {toast} from 'sonner';
import {Checkbox} from '@/components/ui/checkbox';
import {useSupabase} from '@/lib/supabase-provider';
import {addBarcodeToRow} from '@/lib/local/repo';
import {useRow} from '@/lib/local/hooks';
import type {BarcodeData} from '@/lib/local/db';

interface AddBarcodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowId: string;
  onBarcodeAdded?: (barcode: BarcodeData) => void;
  captureLocation: boolean;
  setCaptureLocation: (capture: boolean) => void;
}

const AddBarcodeDialog: React.FC<AddBarcodeDialogProps> = ({ 
  open, 
  onOpenChange, 
  rowId, 
  onBarcodeAdded,
  captureLocation,
  setCaptureLocation
}) => {
  const [code, setCode] = useState('');
  const { user } = useSupabase();
  const { row } = useRow(rowId);

  // Check if this is the first barcode in the row
  const isFirstBarcode = row?.barcodeCount === 0;

  const handleSubmit = async () => {
    if (!code.trim()) return;
    try {
      await addBarcodeToRow(rowId, code, user?.id ?? '');
      toast.success('Barcode added');
      setCode('');
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to add barcode");
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Barcode</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Barcode number"
            className="w-full"
            autoFocus
          />
          
          {isFirstBarcode && (
            <div className="flex items-center mt-3 text-sm">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="capture-location"
                  checked={captureLocation}
                  onCheckedChange={(checked) => setCaptureLocation(!!checked)}
                  className="border-gray-400"
                />
                <label
                  htmlFor="capture-location"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center"
                >
                  <MapPin className="h-4 w-4 mr-1 text-gray-600" />
                  Capture GPS location
                </label>
              </div>
              <span className="ml-2 text-gray-500 text-xs">
                This is the first barcode of this row
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!code.trim()}>
            Add Barcode
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddBarcodeDialog;
