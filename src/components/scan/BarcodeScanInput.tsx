
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Barcode, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useDB } from '@/lib/db-provider';
import { useToast } from '@/components/ui/use-toast';

interface BarcodeScanInputProps {
  rowId: string;
  onBarcodeAdded?: (barcode: any) => void;
  focusInput?: () => void;
}

const BarcodeScanInput: React.FC<BarcodeScanInputProps> = ({ 
  rowId, 
  onBarcodeAdded,
  focusInput
}) => {
  const [barcode, setBarcode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { addBarcode } = useDB();
  const { toast: uiToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Add barcode handler
  const handleAddBarcode = async () => {
    if (!barcode.trim()) return;
    
    setIsProcessing(true);
    try {
      const result = await addBarcode(barcode.trim(), rowId);
      if (result) {
        // Clear input
        setBarcode('');
        toast.success('Barcode added successfully');
        
        // Trigger callback if provided
        if (onBarcodeAdded) {
          onBarcodeAdded(result);
        }
      } else {
        toast.error('Failed to add barcode');
      }
    } catch (error) {
      console.error('Error adding barcode:', error);
      toast.error('Error adding barcode');
    } finally {
      setIsProcessing(false);
      // Focus the input after processing
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleAddBarcode();
  };
  
  // Handle paste event
  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText) {
      setBarcode(pastedText.trim());
      // Don't submit immediately on paste to allow user to confirm
    }
  };
  
  // Focus the input field on component mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  
  // Handle key press - specifically for barcode scanners that send Enter
  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await handleAddBarcode();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        <Barcode className="h-5 w-5" />
      </div>
      <Input
        type="text"
        placeholder="Scan or type barcode"
        className="w-full pl-10 pr-12"
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        ref={inputRef}
        disabled={isProcessing}
        autoFocus
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isProcessing}
          onClick={() => {
            navigator.clipboard.writeText(barcode);
            uiToast({
              title: "Copied to clipboard",
              description: "Barcode text copied to clipboard",
            });
          }}
          className="h-8 w-8 text-muted-foreground"
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
};

export default BarcodeScanInput;
