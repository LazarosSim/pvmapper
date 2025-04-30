
import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useDB } from '@/lib/db-provider';
import Layout from '@/components/layout/layout';
import RowCard from '@/components/rows/row-card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Row } from '@/lib/types/db-types';

const ParkDetail = () => {
  const { parkId } = useParams<{ parkId: string }>();
  const { parks, getRowsByParkId, getParkById, addRow } = useDB();
  const [searchQuery, setSearchQuery] = useState('');

  // Save selected park to localStorage and clear row selection
  // This ensures consistency between HomePage and ScanPage navigation
  useEffect(() => {
    if (parkId) {
      localStorage.setItem('selectedParkId', parkId);
      // We're at park level, so clear any row selection
      localStorage.removeItem('selectedRowId');
    }
  }, [parkId]);

  if (!parkId || !parks.some(p => p.id === parkId)) {
    // Try to get remembered park from localStorage
    const rememberedParkId = localStorage.getItem('selectedParkId');
    if (rememberedParkId && parks.some(p => p.id === rememberedParkId)) {
      return <Navigate to={`/park/${rememberedParkId}`} replace />;
    }
    return <Navigate to="/" replace />;
  }

  const park = getParkById(parkId);
  const rows = getRowsByParkId(parkId);
  
  const filteredRows = rows.filter(row => 
    row.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddRow = async () => {
    // Fix: passing undefined instead of false for the expectedBarcodes parameter
    await addRow(parkId, undefined);
  };

  const groupRows = () => {
    const grouped: { [key: string]: Row[] } = {};
    
    filteredRows.forEach(row => {
      const match = row.name.match(/^Row\s+(\d+)/i);
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
      grouped[key].sort((a, b) => {
        const suffixA = a.name.match(/_([a-z])$/i)?.[1] || '';
        const suffixB = b.name.match(/_([a-z])$/i)?.[1] || '';
        return suffixA.localeCompare(suffixB);
      });
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
          Object.keys(rowGroups).sort((a, b) => {
            if (!isNaN(Number(a)) && !isNaN(Number(b))) {
              return Number(a) - Number(b);
            }
            return a.localeCompare(b);
          }).map(groupKey => (
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
        
        <Button 
          onClick={handleAddRow}
          className="fixed bottom-20 right-4 rounded-full w-14 h-14 shadow-lg bg-inventory-primary hover:bg-inventory-primary/90"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </Layout>
  );
};

export default ParkDetail;
