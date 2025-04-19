
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDB } from '@/lib/db-provider';

interface AddBarcodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowId: string;
}

const AddBarcodeDialog: React.FC<AddBarcodeDialogProps> = ({ open, onOpenChange, rowId }) => {
  const [code, setCode] = useState('');
  const { addBarcode } = useDB();
  
  const handleSubmit = async () => {
    if (code.trim()) {
      await addBarcode(code.trim(), rowId);
      setCode('');
      onOpenChange(false);
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
