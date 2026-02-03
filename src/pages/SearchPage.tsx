import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/layout';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Barcode, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useSearchBarcodes } from '@/hooks/use-search-barcodes';

const SearchPage = () => {
  const [query, setQuery] = useState<string>("");
  const navigate = useNavigate();
  
  const { data: results, isLoading, error } = useSearchBarcodes(query);

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

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="text-center py-8">
          <p className="text-destructive">Error searching barcodes</p>
        </div>
      )}

      {results && results.length > 0 ? (
        <div>
          <h2 className="text-lg font-semibold mb-4">Results ({results.length})</h2>
          {results.map((result) => (
            <Card key={result.id} className="mb-4 hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center">
                  <Barcode className="h-5 w-5 mr-2 text-inventory-primary" />
                  {result.code}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-1">
                  Location: {result.parkName || 'Unknown Park'} / {result.rowName || 'Unknown Row'}
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  Added: {format(new Date(result.timestamp), 'MMM d, yyyy h:mm a')}
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
      ) : query.length >= 3 && !isLoading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No barcodes found matching "{query}"</p>
        </div>
      ) : null}
    </Layout>
  );
};

export default SearchPage;
