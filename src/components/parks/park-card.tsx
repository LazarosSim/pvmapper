import React, {useState} from 'react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {Edit, FileDown, FolderOpen, Loader2, MoreVertical, Trash2} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {formatDistanceToNow} from 'date-fns';
import {Progress} from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {toast} from 'sonner';
import * as XLSX from 'xlsx';
import {Checkbox} from '@/components/ui/checkbox';
import {Barcode} from '@/lib/types/db-types';
import {Park} from "@/types/types.ts";
import {useDeletePark, useUpdatePark} from "@/hooks/use-park-queries.tsx";
import {useCurrentUser} from "@/hooks/use-user.tsx";
import {useRowsByParkId} from "@/hooks/use-row-queries.tsx";
import {useParkBarcodes} from "@/hooks/use-barcodes-queries.tsx";

interface ParkCardProps {
  park: Park;
}

const ParkCard: React.FC<ParkCardProps> = ({
  park
}) => {
  const navigate = useNavigate();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

  const [editName, setEditName] = React.useState(park.name);
  const [editExpectedBarcodes, setEditExpectedBarcodes] = React.useState(park.expectedBarcodes);
  const [validateBarcodeLength, setValidateBarcodeLength] = React.useState(park.validateBarcodeLength || false);

  const [isExporting, setIsExporting] = useState(false);

  const progress = ((park.currentBarcodes / park.expectedBarcodes) * 100).toFixed(2);

  const {data: currentUser} = useCurrentUser()
  const {data: rows} = useRowsByParkId(park.id);
  const {data: barcodes} = useParkBarcodes(park.id);
  const {mutate: updatePark} = useUpdatePark();
  const {mutate: deletePark} = useDeletePark();

  const rowCount = rows?.length;

  const createdAt = formatDistanceToNow(new Date(park?.createdAt), {
    addSuffix: true
  });

  const handleEdit = () => {
    updatePark({id: park.id, name: editName, expectedBarcodes: editExpectedBarcodes, validateBarcodeLength});
    setIsEditDialogOpen(false);
  };

  const handleDelete = () => {
    deletePark(park.id);
    setIsDeleteDialogOpen(false);
  };

  const sanitizeFileName = (name: string): string => {
    return name.replace(/[\\/:*?"<>|]/g, '_');
  };


  const handleExportExcel = async () => {
    if (isExporting) return;
    try {
      setIsExporting(true);
      toast.info('Starting export, please wait...');
      
      const wb = XLSX.utils.book_new();

      // Create a summary sheet first
      const summaryData = [
        ["Park Name", park.name], 
        ["Created", new Date(park.createdAt).toLocaleString()], 
        ["Total Rows", rows.length.toString()],
        ["Total Barcodes", park.currentBarcodes.toString()],
        ["Expected Barcodes", park.expectedBarcodes.toString()],
        ["Completion", `${progress}%`]
      ];

      // Add row information to summary
      rows.forEach((row, index) => {
        summaryData.push([
          `Row ${index + 1}`, row.name, 
          `Expected: ${row.expectedBarcodes || "N/A"}`, 
          `Current: ${row.currentBarcodes || 0}`
        ]);
      });
      
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

      const groupedByRow: Record<string, Barcode[]> = barcodes.reduce(
          (acc, barcode) => {
            const rowId = barcode.rowId;
            if (!acc[rowId]) {
              acc[rowId] = [];
            }
            acc[rowId].push(barcode);
            return acc;
          },
          {} as Record<string, Barcode[]>
      )

      // Create a separate worksheet for each row, regardless of whether it has barcodes
      for (const row of rows) {
        // Create worksheet data with header
        const rowData = [["Barcode"]]; // Start with header row

        const rowBarcodes = groupedByRow[row.id] || [];
        // Add barcode data if available
        if (rowBarcodes.length > 0) {
          rowBarcodes.forEach(barcode => {
            rowData.push([barcode.code]);
          });
        }
        
        // Create the worksheet (even if empty, it will just have the header)
        const ws = XLSX.utils.aoa_to_sheet(rowData);
        
        // Create a safe sheet name (max 31 chars for Excel)
        const safeSheetName = row.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
      }

      const safeFileName = sanitizeFileName(`${park.name}_${new Date().toISOString().split('T')[0]}.xlsx`);

      const wbout = XLSX.write(wb, {
        bookType: 'xlsx',
        type: 'binary'
      });

      const buf = new ArrayBuffer(wbout.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < wbout.length; i++) {
        view[i] = wbout.charCodeAt(i) & 0xFF;
      }

      const blob = new Blob([buf], {
        type: 'application/octet-stream'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = safeFileName;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsExporting(false);
        toast.success("Park data exported successfully");
      }, 100);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsExporting(false);
    }
  };

  const handleOpenPark = () => {
    // Store selected park ID in localStorage for navigation syncing
    localStorage.setItem('selectedParkId', park.id);
    navigate(`/park/${park.id}`);
  };

  const isManager = currentUser?.role === 'manager';

  return <>
    <Card className="mb-4 hover:shadow-md transition-shadow glass-card relative overflow-hidden">
      {/* Semi-transparent background image layer - increased opacity to 50% */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-50 z-0" 
        style={{ 
          backgroundImage: `url(https://ynslzmpfhmoghvcacwzd.supabase.co/storage/v1/object/public/images/XPcanvas.png)` 
        }} 
      />
      
      {/* Content layer (above the background) */}
      <CardHeader className="pb-2 flex flex-row items-center justify-between relative z-10">
        <CardTitle className="text-inventory-text text-xl font-semibold text-left">{park.name}</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleExportExcel} disabled={isExporting} className="text-inventory-secondary hover:text-inventory-secondary/80">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          </Button>
          {isManager && <DropdownMenu>
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
                <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>}
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="text-sm text-muted-foreground mb-2">Created {createdAt}</div>
        
        {park.expectedBarcodes > 0 && <div className="mb-4 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span>Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
          <Progress value={Number(progress)} className="h-2 bg-gray-200">
              <div className="h-full bg-gradient-to-r from-inventory-primary to-inventory-secondary rounded-full" style={{
                width: `${progress}%`
          }} />
            </Progress>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{park.currentBarcodes} scanned</span>
              <span>{park.expectedBarcodes} expected</span>
            </div>
          </div>}
        
        <div className="flex items-center justify-between mt-2">
          <div>
            <span className="text-sm font-medium">{rowCount} Rows</span>
            <span className="mx-2 text-muted-foreground">•</span>
            <span className="text-sm font-medium">{park.currentBarcodes} Barcodes</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleOpenPark} className="bg-inventory-secondary/10 text-inventory-secondary hover:bg-inventory-secondary/20 border-inventory-secondary/30">
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
          <DialogDescription>
            Fill out the form below to edit the park.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Park Name</Label>
            <Input id="name" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Park name" className="w-full" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expected">Expected Barcodes</Label>
            <Input id="expected" type="number" min="0" value={editExpectedBarcodes} onChange={e => setEditExpectedBarcodes(Number(e.target.value))} placeholder="Expected barcodes" className="w-full" />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="validateLength"
              checked={validateBarcodeLength}
              onCheckedChange={(checked) => setValidateBarcodeLength(checked as boolean)}
            />
            <Label htmlFor="validateLength">
              Validate barcode length (19-26 digits)
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleEdit} disabled={!editName.trim() || editExpectedBarcodes < 0} className="bg-inventory-primary hover:bg-inventory-primary/90">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
};

export default ParkCard;
