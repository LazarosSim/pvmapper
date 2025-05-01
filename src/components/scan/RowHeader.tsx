
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Barcode, RotateCcw, Edit, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDB } from '@/lib/db-provider';

interface RowHeaderProps {
  rowId: string;
  breadcrumb: string | undefined;
  totalScannedBarcodes: number;
  expectedBarcodes?: number | null;
  isResetting: boolean;
  onResetClick: () => void;
  focusInput: () => void;
}

const RowHeader: React.FC<RowHeaderProps> = ({
  rowId,
  breadcrumb,
  totalScannedBarcodes,
  expectedBarcodes,
  isResetting,
  onResetClick,
  focusInput
}) => {
  const [isEditingRowName, setIsEditingRowName] = useState(false);
  const [rowName, setRowName] = useState('');
  const { getRowById, updateRow } = useDB();

  const startEditingName = () => {
    const row = getRowById(rowId);
    if (row) {
      setRowName(row.name);
      setIsEditingRowName(true);
    }
  };
  
  const saveRowName = async () => {
    if (rowName.trim()) {
      const result = await updateRow(rowId, rowName);
      if (result !== undefined && result !== null) {
        toast.success("Row name updated successfully");
        setIsEditingRowName(false);
      } else {
        toast.error("Failed to update row name");
      }
    } else {
      toast.error("Row name cannot be empty");
    }
    focusInput();
  };

  const cancelEditName = () => {
    setIsEditingRowName(false);
    focusInput();
  };

  const titleContent = isEditingRowName ? (
    <div className="flex items-center space-x-2">
      <Input
        value={rowName}
        onChange={(e) => setRowName(e.target.value)}
        className="w-40 bg-white text-gray-900 border-gray-300"
        autoFocus
      />
      <Button variant="ghost" size="icon" onClick={saveRowName}>
        <Check className="h-4 w-4 text-green-500" />
      </Button>
      <Button variant="ghost" size="icon" onClick={cancelEditName}>
        <X className="h-4 w-4 text-red-500" />
      </Button>
    </div>
  ) : (
    <div className="flex items-center space-x-2">
      <span>{breadcrumb || 'Scan Barcode'}</span>
      <Button variant="ghost" size="icon" onClick={startEditingName}>
        <Edit className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );

  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center">
        <Barcode className="mr-2 h-5 w-5 text-inventory-primary" />
        Scan Barcode
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium bg-secondary px-3 py-1 rounded-full">
          {totalScannedBarcodes} {expectedBarcodes ? `/ ${expectedBarcodes}` : ''} barcodes
        </span>
        <Button 
          variant="outline" 
          size="icon"
          onClick={onResetClick}
          className="text-inventory-secondary hover:bg-inventory-secondary/10 border-inventory-secondary/30"
          disabled={isResetting}
        >
          {isResetting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
        </Button>
      </div>
      {titleContent}
    </div>
  );
};

export default RowHeader;
