
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Edit, Trash2, MoreVertical, FolderOpen, FileDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDB, Park } from '@/lib/db-provider';
import { formatDistanceToNow } from 'date-fns';
import { Progress } from '@/components/ui/progress';
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
import * as XLSX from 'xlsx';

interface ParkCardProps {
  park: Park;
}

const ParkCard: React.FC<ParkCardProps> = ({ park }) => {
  const navigate = useNavigate();
  const { countBarcodesInPark, getRowsByParkId, deletePark, updatePark, getParkProgress, currentUser, getBarcodesByRowId } = useDB();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editName, setEditName] = React.useState(park.name);
  const [editExpectedBarcodes, setEditExpectedBarcodes] = React.useState(park.expectedBarcodes);
  
  const rowCount = getRowsByParkId(park.id).length;
  const barcodeCount = countBarcodesInPark(park.id);
  const progress = getParkProgress(park.id);
  const createdAt = formatDistanceToNow(new Date(park.createdAt), { addSuffix: true });
  
  const handleEdit = () => {
    updatePark(park.id, editName, editExpectedBarcodes);
    setIsEditDialogOpen(false);
  };
  
  const handleDelete = () => {
    deletePark(park.id);
    setIsDeleteDialogOpen(false);
  };

  const handleExportExcel = () => {
    try {
      // Get all rows for this park
      const rows = getRowsByParkId(park.id);
      
      // Collect all barcodes organized by row
      const rowData = rows.map(row => {
        const barcodes = getBarcodesByRowId(row.id);
        return {
          rowName: row.name,
          barcodes: barcodes.map(bc => ({
            code: bc.code,
            timestamp: new Date(bc.timestamp).toLocaleString()
          }))
        };
      });

      // Prepare workbook and worksheet
      const wb = XLSX.utils.book_new();
      
      // Create a worksheet for park summary
      const summaryData = [
        ["Park Name", park.name],
        ["Created", new Date(park.createdAt).toLocaleString()],
        ["Total Rows", rowCount.toString()],
        ["Total Barcodes", barcodeCount.toString()],
        ["Expected Barcodes", park.expectedBarcodes.toString()],
        ["Completion", `${progress.percentage}%`]
      ];
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, "Park Summary");
      
      // Create worksheet for each row
      rowData.forEach(row => {
        if (row.barcodes.length > 0) {
          // Convert barcodes to array of arrays format
          const data = [["Barcode", "Timestamp"]];
          row.barcodes.forEach(bc => {
            data.push([bc.code, bc.timestamp]);
          });
          
          const ws = XLSX.utils.aoa_to_sheet(data);
          XLSX.utils.book_append_sheet(wb, ws, row.rowName.substring(0, 31));
        }
      });
      
      // Generate Excel file
      XLSX.writeFile(wb, `${park.name}-export.xlsx`);
      toast.success("Park data exported to Excel");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export data");
    }
  };

  const isManager = currentUser?.role === 'manager';
  
  return (
    <>
      <Card className="mb-4 hover:shadow-md transition-shadow glass-card">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-inventory-text">{park.name}</CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleExportExcel}
              className="text-inventory-secondary hover:text-inventory-secondary/80"
            >
              <FileDown className="h-4 w-4" />
            </Button>
            {isManager && (
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
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-2">Created {createdAt}</div>
          
          {park.expectedBarcodes > 0 && (
            <div className="mb-4 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span>Progress</span>
                <span className="font-medium">{progress.percentage}%</span>
              </div>
              <Progress value={progress.percentage} className="h-2 bg-gray-200">
                <div 
                  className="h-full bg-gradient-to-r from-inventory-primary to-inventory-secondary rounded-full" 
                  style={{ width: `${progress.percentage}%` }}
                />
              </Progress>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress.completed} scanned</span>
                <span>{progress.total} expected</span>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between mt-2">
            <div>
              <span className="text-sm font-medium">{rowCount} Rows</span>
              <span className="mx-2 text-muted-foreground">•</span>
              <span className="text-sm font-medium">{barcodeCount} Barcodes</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate(`/park/${park.id}`)}
              className="bg-inventory-secondary/10 text-inventory-secondary hover:bg-inventory-secondary/20 border-inventory-secondary/30"
            >
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
              This will permanently delete "{park.name}" and all of its rows and barcodes.
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
            <DialogTitle>Edit Park</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Park Name</Label>
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Park name"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expected">Expected Barcodes</Label>
              <Input
                id="expected"
                type="number"
                min="0"
                value={editExpectedBarcodes}
                onChange={(e) => setEditExpectedBarcodes(Number(e.target.value))}
                placeholder="Expected barcodes"
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEdit} 
              disabled={!editName.trim() || editExpectedBarcodes < 0}
              className="bg-inventory-primary hover:bg-inventory-primary/90"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ParkCard;
