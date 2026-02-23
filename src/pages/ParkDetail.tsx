import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useDB } from '@/lib/db-provider';
import Layout from '@/components/layout/layout';
import RowCard from '@/components/rows/row-card';
import { Button } from '@/components/ui/button';
import { Plus, List, Loader2 } from 'lucide-react';
import { naturalCompare } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import BulkRowsDialog from '@/components/dialog/bulk-rows-dialog';
import type { Row } from '@/lib/types/db-types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRowsByParkId } from '@/hooks/use-row-queries';
import { useParkStats } from '@/hooks/parks';

const ParkDetail = () => {
  const { parkId } = useParams<{ parkId: string }>();
  const { addRow, isManager } = useDB();
  const { data: parks, isLoading: parksLoading } = useParkStats();
  const { data: rows, isLoading: rowsLoading } = useRowsByParkId(parkId || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddRowDialogOpen, setIsAddRowDialogOpen] = useState(false);
  const [expectedBarcodes, setExpectedBarcodes] = useState<string>('');
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);

  // Save selected park to localStorage and clear row selection
  // This ensures consistency between HomePage and ScanPage navigation
  useEffect(() => {
    if (parkId) {
      localStorage.setItem('selectedParkId', parkId);
      // We're at park level, so clear any row selection
      localStorage.removeItem('selectedRowId');
    }
  }, [parkId]);

  // Show loading state while parks or rows are loading
  if (parksLoading || rowsLoading) {
    return (
      <Layout title="Park Detail" showBack>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!parkId || !parks?.some(p => p.id === parkId)) {
    // Try to get remembered park from localStorage
    const rememberedParkId = localStorage.getItem('selectedParkId');
    if (rememberedParkId && parks?.some(p => p.id === rememberedParkId)) {
      return <Navigate to={`/park/${rememberedParkId}`} replace />;
    }
    return <Navigate to="/" replace />;
  }

  const park = parks?.find(p => p.id === parkId);
  
  const filteredRows = (rows || []).filter(row => 
    row.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenAddDialog = () => {
    setExpectedBarcodes('');
    setIsAddRowDialogOpen(true);
  };

  const handleAddRow = async () => {
    try {
      setIsAddRowDialogOpen(false);
      
      // Parse expected barcodes or set to undefined if empty
      const expectedBarcodesValue = expectedBarcodes.trim() 
        ? parseInt(expectedBarcodes, 10) 
        : undefined;
      
      await addRow(parkId, expectedBarcodesValue);
      setExpectedBarcodes('');
    } catch (error) {
      console.error("Error adding row:", error);
    }
  };

  const groupRows = () => {
    const grouped: { [key: string]: Row[] } = {};
    
    filteredRows.forEach(row => {
      const match = row.name.match(/^Row\s+([\d.]+)/i);
      if (match) {
        const baseNum = match[1];
        if (!grouped[baseNum]) {
          grouped[baseNum] = [];
        }
        grouped[baseNum].push(row);
      } else {
        if (!grouped['other']) {
          grouped['other'] = [];
        }
        grouped['other'].push(row);
      }
    });
    
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => naturalCompare(a.name, b.name));
    });
    
    return grouped;
  };
  
  const rowGroups = groupRows();

  return (
    <Layout title={park?.name || 'Park Detail'} showBack>
      <div className="flex flex-col">
        <div className="flex items-center space-x-2 mb-6">
          <Input
            placeholder="Search rows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
        </div>

        {Object.keys(rowGroups).length > 0 ? (
          Object.keys(rowGroups).sort((a, b) => naturalCompare(a, b)).map(groupKey => (
            <div key={groupKey} className="mb-6">
              <div className="flex flex-wrap gap-4">
                {rowGroups[groupKey].map(row => (
                  <div key={row.id} className="w-full md:w-auto flex-grow">
                    <RowCard 
                      row={row} 
                      onOpen={() => {
                        // When opening a row, store both the park ID and row ID
                        localStorage.setItem('selectedParkId', parkId);
                        localStorage.setItem('selectedRowId', row.id);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "No rows found matching your search" : "No rows found. Add your first row to get started."}
            </p>
          </div>
        )}
        
        {isManager() ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                className="fixed bottom-20 right-4 rounded-full w-14 h-14 shadow-lg bg-inventory-primary hover:bg-inventory-primary/90"
              >
                <Plus className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={handleOpenAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Single Row
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsBulkDialogOpen(true)}>
                <List className="h-4 w-4 mr-2" />
                Bulk Add Rows
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button 
            onClick={handleOpenAddDialog}
            className="fixed bottom-20 right-4 rounded-full w-14 h-14 shadow-lg bg-inventory-primary hover:bg-inventory-primary/90"
          >
            <Plus className="h-6 w-6" />
          </Button>
        )}

        {/* Dialog for adding a new row with expected barcodes */}
        <Dialog open={isAddRowDialogOpen} onOpenChange={setIsAddRowDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Row</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="expected-barcodes">Expected Barcodes</Label>
                <Input
                  id="expected-barcodes"
                  type="number"
                  min="0"
                  value={expectedBarcodes}
                  onChange={(e) => setExpectedBarcodes(e.target.value)}
                  placeholder="Leave empty for unlimited"
                  className="w-full"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Set the maximum number of barcodes for this row. Leave empty for unlimited.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddRowDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddRow}>
                Add Row
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Bulk row creation dialog */}
        <BulkRowsDialog
          open={isBulkDialogOpen}
          onOpenChange={setIsBulkDialogOpen}
          parkId={parkId}
        />
      </div>
    </Layout>
  );
};

export default ParkDetail;
