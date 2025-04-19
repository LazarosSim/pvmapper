
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Edit, Trash2, MoreVertical, FolderOpen } from 'lucide-react';
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

interface RowCardProps {
  row: Row;
}

const RowCard: React.FC<RowCardProps> = ({ row }) => {
  const navigate = useNavigate();
  const { countBarcodesInRow, deleteRow, updateRow } = useDB();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editName, setEditName] = React.useState(row.name);
  const [isDeleting, setIsDeleting] = React.useState(false);
  
  const barcodeCount = countBarcodesInRow(row.id);
  const createdAt = formatDistanceToNow(new Date(row.createdAt), { addSuffix: true });
  
  const handleEdit = () => {
    updateRow(row.id, editName);
    setIsEditDialogOpen(false);
  };
  
  // Modified delete handler to fix freezing issues
  const handleDelete = () => {
    setIsDeleting(true);
    setIsDeleteDialogOpen(false);
    
    // Use requestAnimationFrame to ensure UI updates before deletion
    requestAnimationFrame(() => {
      // Use setTimeout to provide extra time for the UI to update
      setTimeout(() => {
        try {
          // Then perform the delete operation
          deleteRow(row.id)
            .finally(() => {
              setIsDeleting(false);
            });
        } catch (error) {
          console.error("Error deleting row:", error);
          setIsDeleting(false);
        }
      }, 150); // Slightly longer delay
    });
  };
  
  return (
    <>
      <Card className="mb-4 hover:shadow-md transition-shadow">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">{row.name}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-2">Created {createdAt}</div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">{barcodeCount} Barcodes</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate(`/row/${row.id}`)}>
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
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground"
              disabled={isDeleting}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </Dialog>
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Row</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Row name"
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!editName.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RowCard;
