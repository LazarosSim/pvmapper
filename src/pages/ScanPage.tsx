import React, { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
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
import { FolderOpen } from 'lucide-react';

const ScanPage = () => {
  const { parks } = useDB();
  const navigate = useNavigate();

  // Check for remembered park when component mounts
  useEffect(() => {
    const rememberedParkId = localStorage.getItem('selectedParkId');
    // If we have a selected park in localStorage and it exists in our parks list
    if (rememberedParkId && parks.some(p => p.id === rememberedParkId)) {
      // Also check if there's a selected row
      const rememberedRowId = localStorage.getItem('selectedRowId');
      if (rememberedRowId) {
        // Navigate to the row scanning page if we have a selected row
        navigate(`/scan/row/${rememberedRowId}`, { replace: true });
      } else {
        // Otherwise just navigate to the park scanning page
        navigate(`/scan/park/${rememberedParkId}`, { replace: true });
      }
    }
  }, [parks, navigate]);

  if (parks.length === 0) {
    return <Navigate to="/" replace />;
  }

  return (
    <Layout title="Select Park">
      <div className="space-y-4">
        {parks.map(park => (
          <Card key={park.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">{park.name}</CardTitle>
              <CardDescription>
                Select this park to continue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  localStorage.setItem('selectedParkId', park.id);
                  navigate(`/scan/park/${park.id}`);
                }}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Select Park
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </Layout>
  );
};

export default ScanPage;
