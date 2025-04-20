
import React, { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useDB } from '@/lib/db-provider';
import Layout from '@/components/layout/layout';
import { Button } from '@/components/ui/button';
import { Plus, RotateCcw } from 'lucide-react';
import AddBarcodeDialog from '@/components/dialog/add-barcode-dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

const RowDetail = () => {
  const { rowId } = useParams<{ rowId: string }>();
  const { rows, getRowById, getBarcodesByRowId, getParkById, resetRow } = useDB();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  if (!rowId || !rows.some(r => r.id === rowId)) {
    return <Navigate to="/" replace />;
  }

  const row = getRowById(rowId);
  const barcodes = getBarcodesByRowId(rowId);
  const park = row ? getParkById(row.parkId) : undefined;
  
  const filteredBarcodes = barcodes.filter(barcode => 
    barcode.code.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const breadcrumb = park ? `${park.name} / ${row?.name}` : row?.name;

  const handleReset = async () => {
    await resetRow(rowId);
    setIsResetDialogOpen(false);
  };

  return (
    <Layout title={breadcrumb || 'Row Detail'} showBack>
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <Input
            placeholder="Search barcodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 mr-2"
          />
          <Button 
            variant="outline"
            onClick={() => setIsResetDialogOpen(true)}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Row
          </Button>
        </div>

        {filteredBarcodes.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">No.</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead className="w-40">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBarcodes.map((barcode, index) => (
                  <TableRow key={barcode.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{barcode.code}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(barcode.timestamp).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "No barcodes found matching your search" : "No barcodes found. Add your first barcode to get started."}
            </p>
          </div>
        )}
        
        <Button 
          onClick={() => setIsDialogOpen(true)}
          className="fixed bottom-20 right-4 rounded-full w-14 h-14 shadow-lg bg-inventory-primary hover:bg-inventory-primary/90"
        >
          <Plus className="h-6 w-6" />
        </Button>
        
        <AddBarcodeDialog 
          open={isDialogOpen} 
          onOpenChange={setIsDialogOpen} 
          rowId={rowId}
        />

        <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete all barcodes in this row. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground">
                Reset Row
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default RowDetail;
