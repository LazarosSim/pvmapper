
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

interface CreateParkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreateParkDialog: React.FC<CreateParkDialogProps> = ({ open, onOpenChange }) => {
  const [name, setName] = useState('');
  const { addPark } = useDB();
  
  const handleSubmit = async () => {
    if (name.trim()) {
      await addPark(name.trim());
      setName('');
      onOpenChange(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Park</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Park name"
            className="w-full"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            Create Park
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateParkDialog;
