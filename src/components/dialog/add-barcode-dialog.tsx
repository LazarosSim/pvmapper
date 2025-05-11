
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
import { MapPin, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

interface AddBarcodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowId: string;
  onBarcodeAdded?: (barcode: any) => void;
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
  const { addBarcode, countBarcodesInRow } = useDB();
  
  // Check if this is the first barcode in the row
  const isFirstBarcode = countBarcodesInRow(rowId) === 0;
  
  const captureGPSLocation = async (): Promise<{latitude: number, longitude: number} | null> => {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          toast.error("Geolocation is not supported by this browser");
          reject("Geolocation not supported");
          return;
        }
        
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
      });
      
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
    } catch (error) {
      console.error("Error getting location:", error);
      toast.error("Unable to get location. Please ensure location services are enabled.");
      return null;
    }
  };
  
  const handleSubmit = async () => {
    if (code.trim()) {
      // Capture GPS location only if this is the first barcode in the row and location capture is enabled
      let location = null;
      if (isFirstBarcode && captureLocation) {
        toast.loading("Capturing location...");
        location = await captureGPSLocation();
        if (!location) {
          toast.dismiss();
          toast.warning("Location capture failed, but proceeding with barcode registration");
        } else {
          toast.dismiss();
          toast.success("Location captured successfully");
        }
      }
      
      const result = await addBarcode(code.trim(), rowId, undefined, location);
      if (result) {
        setCode('');
        toast.success('Barcode added successfully');
        
        // Call the onBarcodeAdded callback if provided
        if (onBarcodeAdded) {
          onBarcodeAdded(result);
        }
        
        onOpenChange(false);
      } else {
        toast.error('Failed to add barcode');
      }
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
                  Capture location
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
