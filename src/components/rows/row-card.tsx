
import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDB } from '@/lib/db-provider';
import { Edit, Trash2, BarChart3, RefreshCcw, Plus } from 'lucide-react';
import { Row } from '@/lib/db-provider';

type RowCardProps = {
  row: Row;
  onAddSubRow?: (rowId: string) => void;
};

const RowCard = ({ row, onAddSubRow }: RowCardProps) => {
  const { updateRow, deleteRow, resetRow, countBarcodesInRow } = useDB();

  const handleReset = async () => {
    if (window.confirm(`Are you sure you want to reset ${row.name}? This will remove all barcodes in this row.`)) {
      await resetRow(row.id);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${row.name}?`)) {
      await deleteRow(row.id);
    }
  };

  const handleAddSubRow = () => {
    if (onAddSubRow) {
      onAddSubRow(row.id);
    }
  };

  const barcodeCount = countBarcodesInRow(row.id);

  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base font-medium">{row.name}</CardTitle>
          <span className="text-sm text-muted-foreground">{barcodeCount} barcodes</span>
        </div>
        <CardDescription>
          Created {new Date(row.createdAt).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link to={`/row/${row.id}`}>
              <BarChart3 className="mr-1 h-4 w-4" />
              Details
            </Link>
          </Button>
          {onAddSubRow && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleAddSubRow}
              className="flex-1"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Subrow
            </Button>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-0 flex justify-between">
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <RefreshCcw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default RowCard;
