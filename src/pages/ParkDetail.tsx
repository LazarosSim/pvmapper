
import React, { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useDB } from '@/lib/db-provider';
import Layout from '@/components/layout/layout';
import RowCard from '@/components/rows/row-card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';

const ParkDetail = () => {
  const { parkId } = useParams<{ parkId: string }>();
  const { parks, getRowsByParkId, getParkById, addRow } = useDB();
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
    await addRow(parkId);
  };

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

        {filteredRows.length > 0 ? (
          filteredRows.map(row => (
            <RowCard key={row.id} row={row} />
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
