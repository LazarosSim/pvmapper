
import React from 'react';
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
import { FolderOpen, Plus } from 'lucide-react';

const ScanParkPage = () => {
  const { parkId } = useParams<{ parkId: string }>();
  const { parks, getRowsByParkId, getParkById, addRow, addSubRow, countBarcodesInRow } = useDB();
  const navigate = useNavigate();

  if (!parkId || !parks.some(p => p.id === parkId)) {
    return <Navigate to="/scan" replace />;
  }

  const park = getParkById(parkId);
  const rows = getRowsByParkId(parkId);

  const handleAddRow = async () => {
    try {
      // Add row without automatic navigation
      await addRow(parkId, false);
    } catch (error) {
      console.error("Error adding row:", error);
    }
  };
  
  const handleAddSubRow = async (parentRowId: string) => {
    try {
      await addSubRow(parentRowId);
    } catch (error) {
      console.error("Error adding subrow:", error);
    }
  };
  
  // Group rows by their base number for display
  const groupRows = () => {
    const grouped: { [key: string]: { rows: any[], order: number } } = {};
    
    rows.forEach(row => {
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
      <div className="space-y-8">
        {/* Render grouped rows */}
        {Object.keys(rowGroups).length > 0 ? (
          Object.keys(rowGroups)
            .sort((a, b) => rowGroups[a].order - rowGroups[b].order)
            .map(groupKey => (
              <div key={groupKey} className="space-y-4">
                <div className="flex flex-col space-y-4">
                  {rowGroups[groupKey].rows.map(row => (
                    <Card key={row.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-lg font-semibold">{row.name}</CardTitle>
                          <span className="text-sm text-muted-foreground">
                            {countBarcodesInRow(row.id)} barcodes
                          </span>
                        </div>
                        <CardDescription>
                          Select this row to scan barcodes
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between gap-2">
                          <Button 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => navigate(`/scan/row/${row.id}`)}
                          >
                            <FolderOpen className="mr-2 h-4 w-4" />
                            Select Row
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleAddSubRow(row.id)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Subrow
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              No rows found. Add your first row to get started.
            </p>
          </div>
        )}
        
        <Button 
          onClick={handleAddRow}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add New Row
        </Button>
      </div>
    </Layout>
  );
};

export default ScanParkPage;
