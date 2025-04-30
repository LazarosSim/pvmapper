import React, { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import Layout from '@/components/layout/layout';
import { useDB } from '@/lib/db-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FolderOpen, Plus, Search, ArrowDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Row } from '@/lib/types/db-types';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';

const ScanParkPage = () => {
  const { parkId } = useParams<{ parkId: string }>();
  const { parks, getRowsByParkId, getParkById, addRow, countBarcodesInRow, addSubRow, isManager } = useDB();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddSubRowDialogOpen, setIsAddSubRowDialogOpen] = useState(false);
  const [selectedParentRowId, setSelectedParentRowId] = useState<string | null>(null);
  const [expectedBarcodes, setExpectedBarcodes] = useState<string>('');

  if (!parkId || !parks.some(p => p.id === parkId)) {
    return <Navigate to="/scan" replace />;
  }

  const park = getParkById(parkId);
  const rows = getRowsByParkId(parkId);
  
  const filteredRows = rows.filter(row => 
    row.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddRow = async () => {
    try {
      // In ScanParkPage, add row without asking for expected barcodes
      await addRow(parkId, undefined, false);
    } catch (error) {
      console.error("Error adding row:", error);
    }
  };

  const handleAddSubRow = async () => {
    try {
      setIsAddSubRowDialogOpen(false);
      
      if (selectedParentRowId) {
        // Parse expected barcodes or set to undefined if empty
        const expectedBarcodesValue = expectedBarcodes.trim() 
          ? parseInt(expectedBarcodes, 10) 
          : undefined;
        
        const newRow = await addSubRow(selectedParentRowId, expectedBarcodesValue);
        if (newRow) {
          toast.success(`Added subrow ${newRow.name}`);
        }
      }
      
      setExpectedBarcodes('');
      setSelectedParentRowId(null);
    } catch (error) {
      console.error("Error adding subrow:", error);
      toast.error("Failed to add subrow");
    }
  };
  
  const handleSelectRow = (rowId: string) => {
    navigate(`/scan/row/${rowId}`);
  };
  
  const openAddSubRowDialog = (parentRowId: string) => {
    setSelectedParentRowId(parentRowId);
    setExpectedBarcodes('');
    setIsAddSubRowDialogOpen(true);
  };
  
  // Group rows by their base number for display
  const groupRows = () => {
    const grouped: { [key: string]: { rows: Row[], order: number } } = {};
    
    filteredRows.forEach(row => {
      // Extract row number (e.g. "Row 1_a" -> "1")
      const match = row.name.match(/^Row\s+(\d+)/i);
      if (match) {
        const baseNum = match[1];
        const order = parseInt(baseNum);
        if (!grouped[baseNum]) {
          grouped[baseNum] = { rows: [], order };
        }
        grouped[baseNum].rows.push(row);
      } else {
        // Fallback for rows that don't match the pattern
        if (!grouped['other']) {
          grouped['other'] = { rows: [], order: Infinity };
        }
        grouped['other'].rows.push(row);
      }
    });
    
    // Sort rows within each group
    Object.keys(grouped).forEach(key => {
      grouped[key].rows.sort((a, b) => {
        // Sort by suffix (a, b, c, etc.) if they have the same base number
        const suffixA = a.name.match(/_([a-z])$/i)?.[1] || '';
        const suffixB = b.name.match(/_([a-z])$/i)?.[1] || '';
        return suffixA.localeCompare(suffixB);
      });
    });
    
    return grouped;
  };
  
  const rowGroups = groupRows();

  return (
    <Layout title={park?.name || 'Select Row'} showBack>
      <div className="space-y-4">
        <div className="flex items-center space-x-2 mb-4">
          <Input
            placeholder="Search rows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Button variant="ghost" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* Render grouped rows */}
        {Object.keys(rowGroups).length > 0 ? (
          Object.keys(rowGroups)
            .sort((a, b) => rowGroups[a].order - rowGroups[b].order)
            .map(groupKey => (
              <div key={groupKey} className="mb-6">
                <div className="flex flex-wrap gap-4">
                  {rowGroups[groupKey].rows.map(row => (
                    <div key={row.id} className="w-full md:w-auto flex-grow">
                      <Card key={row.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-center">
                            <CardTitle className="text-lg font-semibold">{row.name}</CardTitle>
                            <span className="text-sm text-muted-foreground">
                              {countBarcodesInRow(row.id)} {row.expectedBarcodes ? `/ ${row.expectedBarcodes}` : ''} barcodes
                            </span>
                          </div>
                          <CardDescription>
                            Select this row to scan barcodes
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={() => handleSelectRow(row.id)}
                          >
                            <FolderOpen className="mr-2 h-4 w-4" />
                            Select Row
                          </Button>
                          <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() => openAddSubRowDialog(row.id)}
                          >
                            <ArrowDown className="mr-2 h-4 w-4" />
                            Add Subrow
                          </Button>
                        </CardContent>
                      </Card>
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
        
        <div className="pt-4">
          <Button 
            onClick={handleAddRow}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Row
          </Button>
        </div>
      </div>

      {/* Dialog for adding a subrow */}
      <Dialog open={isAddSubRowDialogOpen} onOpenChange={setIsAddSubRowDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Subrow</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subrow-expected-barcodes">Expected Barcodes</Label>
              <Input
                id="subrow-expected-barcodes"
                type="number"
                min="0"
                value={expectedBarcodes}
                onChange={(e) => setExpectedBarcodes(e.target.value)}
                placeholder="Leave empty for unlimited"
                className="w-full"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Set the maximum number of barcodes for this subrow. Leave empty for unlimited.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddSubRowDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSubRow}>
              Add Subrow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default ScanParkPage;
