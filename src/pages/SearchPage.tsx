
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/layout';
import { useDB } from '@/lib/db-provider';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Barcode } from 'lucide-react';
import { format } from 'date-fns';

const SearchPage = () => {
  const { searchBarcodes, getRowById, getParkById } = useDB();
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<Array<{
    barcode: string;
    timestamp: string;
    row: string;
    park: string;
    rowId: string;
  }>>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.length >= 3) {
      const barcodes = searchBarcodes(query);
      const processed = barcodes.map(barcode => {
        const row = getRowById(barcode.rowId);
        const park = row ? getParkById(row.parkId) : undefined;
        
        return {
          barcode: barcode.code,
          timestamp: format(new Date(barcode.timestamp), 'MMM d, yyyy h:mm a'),
          row: row?.name || 'Unknown Row',
          park: park?.name || 'Unknown Park',
          rowId: barcode.rowId
        };
      });
      
      setResults(processed);
    } else {
      setResults([]);
    }
  }, [query]);

  return (
    <Layout title="Search">
      <div className="mb-6">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search barcodes..."
          className="w-full"
        />
        {query.length > 0 && query.length < 3 && (
          <p className="text-xs text-muted-foreground mt-1">Enter at least 3 characters</p>
        )}
      </div>

      {results.length > 0 ? (
        <div>
          <h2 className="text-lg font-semibold mb-4">Results ({results.length})</h2>
          {results.map((result, index) => (
            <Card key={index} className="mb-4 hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center">
                  <Barcode className="h-5 w-5 mr-2 text-inventory-primary" />
                  {result.barcode}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-1">
                  Location: {result.park} / {result.row}
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  Added: {result.timestamp}
                </p>
                <div className="flex justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => navigate(`/row/${result.rowId}`)}
                  >
                    View Row
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : query.length >= 3 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No barcodes found matching "{query}"</p>
        </div>
      ) : null}
    </Layout>
  );
};

export default SearchPage;
