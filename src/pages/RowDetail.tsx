
import React, { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useDB } from '@/lib/db-provider';
import Layout from '@/components/layout/layout';
import BarcodeCard from '@/components/barcodes/barcode-card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import AddBarcodeDialog from '@/components/dialog/add-barcode-dialog';
import { Input } from '@/components/ui/input';

const RowDetail = () => {
  const { rowId } = useParams<{ rowId: string }>();
  const { rows, getRowById, getBarcodesByRowId, getParkById } = useDB();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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

  return (
    <Layout title={breadcrumb || 'Row Detail'} showBack>
      <div className="flex flex-col">
        <div className="flex items-center space-x-2 mb-6">
          <Input
            placeholder="Search barcodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
        </div>

        {filteredBarcodes.length > 0 ? (
          filteredBarcodes.map(barcode => (
            <BarcodeCard key={barcode.id} barcode={barcode} />
          ))
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
      </div>
    </Layout>
  );
};

export default RowDetail;
