import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Edit, Trash2, MoreVertical, FolderOpen, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDB, Row } from '@/lib/db-provider';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface RowCardProps {
  row: Row;
  onOpen?: () => void; // Made optional to maintain backward compatibility
}

const RowCard: React.FC<RowCardProps> = ({ row, onOpen }) => {
  const navigate = useNavigate();
  const { countBarcodesInRow, deleteRow, updateRow, addSubRow, isManager } = useDB();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editName, setEditName] = React.useState(row.name);
  const [editExpectedBarcodes, setEditExpectedBarcodes] = React.useState<string>(
    row.expectedBarcodes !== undefined && row.expectedBarcodes !== null ? String(row.expectedBarcodes) : ''
  );
  
  // Use the currentBarcodes directly from the row object
  const barcodeCount = row.currentBarcodes || 0;
  const createdAt = formatDistanceToNow(new Date(row.createdAt), { addSuffix: true });
  
  const handleEdit = () => {
    const expectedBarcodesValue = editExpectedBarcodes.trim() 
      ? parseInt(editExpectedBarcodes, 10) 
      : undefined;
    
    updateRow(row.id, editName, expectedBarcodesValue);
    setIsEditDialogOpen(false);
  };
  
  const handleDelete = () => {
    // Check if the row has expected barcodes and the user is not a manager
    if (row.expectedBarcodes !== undefined && row.expectedBarcodes !== null && !isManager()) {
      toast.error("Only managers can delete rows with defined barcode limits");
      setIsDeleteDialogOpen(false);
      return;
    }
    
    deleteRow(row.id);
    setIsDeleteDialogOpen(false);
  };
  
  const handleAddSubRow = async () => {
    await addSubRow(row.id);
  };

  const handleOpenRow = () => {
    // Call the onOpen callback if provided
    if (onOpen) {
      onOpen();
    }
    navigate(`/row/${row.id}`);
  };

  const openEditDialog = () => {
    setEditName(row.name);
    setEditExpectedBarcodes(
      row.expectedBarcodes !== undefined && row.expectedBarcodes !== null ? String(row.expectedBarcodes) : ''
    );
    setIsEditDialogOpen(true);
  };

  return (
    <>
      <Card className="mb-4 hover:shadow-md transition-shadow">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">{row.name}</CardTitle>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleAddSubRow}
              className="hidden md:flex"
              title="Add Subrow"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Subrow
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleAddSubRow} className="md:hidden">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Subrow
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openEditDialog}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Row
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => {
                    if (row.expectedBarcodes !== undefined && row.expectedBarcodes !== null && !isManager()) {
                      toast.error("Only managers can delete rows with defined barcode limits");
                      return;
                    }
                    setIsDeleteDialogOpen(true);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-2">Created {createdAt}</div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">
                {barcodeCount} {row.expectedBarcodes ? `/ ${row.expectedBarcodes}` : ''} Barcodes
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={handleOpenRow}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Open
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{row.name}" and all of its barcodes.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Row</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="row-name">Row Name</Label>
              <Input
                id="row-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Row name"
                className="w-full"
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="expected-barcodes">Expected Barcodes</Label>
              <Input
                id="expected-barcodes"
                type="number"
                min="0"
                value={editExpectedBarcodes}
                onChange={(e) => setEditExpectedBarcodes(e.target.value)}
                placeholder="Leave empty for unlimited"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Set the maximum number of barcodes for this row. Leave empty for unlimited.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!editName.trim() || editName === row.name && editExpectedBarcodes === (row.expectedBarcodes !== undefined && row.expectedBarcodes !== null ? String(row.expectedBarcodes) : '')}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RowCard;
