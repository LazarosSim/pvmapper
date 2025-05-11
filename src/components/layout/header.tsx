
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings, Edit, MapPin, RotateCcw, Check, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useDB } from '@/lib/db-provider';
import { Checkbox } from '@/components/ui/checkbox';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  titleAction?: React.ReactNode;
  showSettings?: boolean;
  rowId?: string;
  captureLocation?: boolean;
  setCaptureLocation?: (value: boolean) => void;
  onReset?: () => void;
  onRename?: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  title, 
  showBack = false, 
  titleAction,
  showSettings = false,
  rowId,
  captureLocation = false,
  setCaptureLocation,
  onReset,
  onRename
}) => {
  const navigate = useNavigate();
  const [isEditingRowName, setIsEditingRowName] = useState(false);
  const [rowName, setRowName] = useState('');
  const { updateRow } = useDB();
  
  const handleBackClick = () => {
    navigate(-1);
  };
  
  const startEditingName = () => {
    if (onRename) {
      onRename();
      return;
    }
    
    if (rowId) {
      setRowName(title);
      setIsEditingRowName(true);
    }
  };
  
  const saveRowName = async () => {
    if (rowId && rowName.trim()) {
      await updateRow(rowId, rowName);
      setIsEditingRowName(false);
      toast.success("Row name updated successfully");
    } else {
      toast.error("Row name cannot be empty");
    }
  };
  
  const cancelEditName = () => {
    setIsEditingRowName(false);
  };
  
  const handleToggleLocation = () => {
    if (setCaptureLocation) {
      setCaptureLocation(!captureLocation);
      toast.success(`Location capture ${!captureLocation ? 'enabled' : 'disabled'}`);
    }
  };
  
  return (
    <header className="sticky top-0 w-full bg-gradient-to-r from-xpenergy-primary to-xpenergy-secondary text-white py-4 px-4 flex items-center z-10 shadow-md">
      <div className="flex-1 flex items-center">
        {showBack && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleBackClick}
            className="mr-2 text-white hover:bg-xpenergy-primary/20 hover:text-white/90"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
        )}
        <div className="flex items-center">
          <img 
            src="https://ynslzmpfhmoghvcacwzd.supabase.co/storage/v1/object/public/images/xplogo.png"
            alt="XP Energy Logo" 
            className="h-10 mr-3"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.src = '/placeholder.svg';
              console.error('Failed to load XP Energy logo');
            }}
          />
          {titleAction ? titleAction : <h1 className="text-xl font-semibold font-montserrat">{title}</h1>}
        </div>
      </div>
      
      {/* Settings Dropdown */}
      {showSettings && (
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-xpenergy-primary/20">
                <Settings className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white">
              <DropdownMenuItem onSelect={startEditingName}>
                <Edit className="mr-2 h-4 w-4" />
                <span>Rename Row</span>
              </DropdownMenuItem>
              {onReset && (
                <DropdownMenuItem onSelect={onReset}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  <span>Reset Row</span>
                </DropdownMenuItem>
              )}
              {setCaptureLocation && (
                <DropdownMenuItem onSelect={handleToggleLocation}>
                  <div className="flex items-center w-full">
                    <MapPin className="mr-2 h-4 w-4" />
                    <span>Capture GPS Location</span>
                    <div className="ml-auto">
                      <Checkbox 
                        checked={captureLocation}
                        className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                      />
                    </div>
                  </div>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      
      {/* Editing Row Name Modal */}
      {isEditingRowName && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg w-80">
            <h3 className="font-medium mb-2 text-gray-900">Rename Row</h3>
            <Input
              value={rowName}
              onChange={(e) => setRowName(e.target.value)}
              className="mb-4 text-gray-900"
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={cancelEditName}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={saveRowName}>
                <Check className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
