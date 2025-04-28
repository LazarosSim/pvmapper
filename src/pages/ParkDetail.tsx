
import React, { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useDB } from '@/lib/db-provider';
import Layout from '@/components/layout/layout';
import RowCard from '@/components/rows/row-card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Row } from '@/lib/db-provider';

const ParkDetail = () => {
  const { parkId } = useParams<{ parkId: string }>();
  const { parks, getRowsByParkId, getParkById, addRow, addSubRow } = useDB();
  const [searchQuery, setSearchQuery] = useState('');

  if (!parkId || !parks.some(p => p.id === parkId)) {
    return <Navigate to="/" replace />;
  }

  const park = getParkById(parkId);
  const rows = getRowsByParkId(parkId);
  
  const filteredRows = rows.filter(row => 
    row.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddRow = async () => {
    await addRow(parkId, false);
  };
  
  const handleAddSubRow = async (parentRowId: string) => {
    await addSubRow(parentRowId);
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
                    <RowCard row={row} onAddSubRow={handleAddSubRow} />
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
