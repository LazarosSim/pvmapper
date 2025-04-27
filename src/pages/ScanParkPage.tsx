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
  const { parks, getRowsByParkId, getParkById, addRow, countBarcodesInRow } = useDB();
  const navigate = useNavigate();

  if (!parkId || !parks.some(p => p.id === parkId)) {
    return <Navigate to="/scan" replace />;
  }

  const park = getParkById(parkId);
  const rows = getRowsByParkId(parkId);

  const handleAddRow = async () => {
    try {
      const newRow = await addRow(parkId);
      if (newRow) {
        navigate(`/scan/row/${newRow.id}`);
      }
    } catch (error) {
      console.error("Error adding row:", error);
    }
  };

  return (
    <Layout title={park?.name || 'Select Row'} showBack>
      <div className="space-y-4">
        {rows.map(row => (
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
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate(`/scan/row/${row.id}`)}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Select Row
              </Button>
            </CardContent>
          </Card>
        ))}
        
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
