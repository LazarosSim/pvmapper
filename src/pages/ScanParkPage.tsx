
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
import { FolderOpen, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Row } from '@/lib/db-provider';

const ScanParkPage = () => {
  const { parkId } = useParams<{ parkId: string }>();
  const { parks, getRowsByParkId, getParkById, addRow, addSubRow, countBarcodesInRow } = useDB();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

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
    const grouped: { [key: string]: Row[] } = {};
    
    filteredRows.forEach(row => {
      // Extract row number (e.g. "Row 1_a" -> "1")
      const match = row.name.match(/^Row\s+(\d+)/i);
      if (match) {
        const baseNum = match[1];
        if (!grouped[baseNum]) {
          grouped[baseNum] = [];
        }
        grouped[baseNum].push(row);
      } else {
        // Fallback for rows that don't match the pattern
        if (!grouped['other']) {
          grouped['other'] = [];
        }
        grouped['other'].push(row);
      }
    });
    
    // Sort rows within each group
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => {
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
        <div className="flex items-center space-x-2 mb-6">
          <Input
            placeholder="Search rows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
        </div>

        {/* Render grouped rows */}
        {Object.keys(rowGroups).length > 0 ? (
          Object.keys(rowGroups)
            .sort((a, b) => {
              if (!isNaN(Number(a)) && !isNaN(Number(b))) {
                return Number(a) - Number(b);
              }
              return a.localeCompare(b);
            })
            .map(groupKey => (
              <div key={groupKey} className="mb-6">
                <div className="flex flex-wrap gap-4">
                  {rowGroups[groupKey].map(row => (
                    <div key={row.id} className="w-full md:w-auto flex-grow">
                      <Card className="hover:shadow-md transition-shadow h-full">
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
