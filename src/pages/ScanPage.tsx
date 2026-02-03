
import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/layout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FolderOpen, Loader2 } from 'lucide-react';
import { useParkStats } from '@/hooks/parks';

const ScanPage = () => {
  const { data: parks, isLoading } = useParkStats();
  const navigate = useNavigate();
  // Set captureLocation to true by default
  const [captureLocation, setCaptureLocation] = useState(true);

  if (isLoading) {
    return (
      <Layout title="Select Park" showBack>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!parks || parks.length === 0) {
    return <Navigate to="/" replace />;
  }

  return (
    <Layout 
      title="Select Park" 
      showBack
      captureLocation={captureLocation}
      setCaptureLocation={setCaptureLocation}
    >
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
