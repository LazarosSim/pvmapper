
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FolderOpen, FolderEdit, Database, Scan, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import type { Park } from '@/lib/types/db-types';
import { useDB } from '@/lib/db-provider';

interface ParkCardProps {
  park: Park;
}

const ParkCard: React.FC<ParkCardProps> = ({ park }) => {
  const { countRowsInPark, countBarcodesInPark } = useDB();
  const rowCount = countRowsInPark(park.id);
  const barcodeCount = countBarcodesInPark(park.id);
  
  let lastUpdated = 'Never updated';
  if (park.updatedAt) {
    lastUpdated = formatDistanceToNow(new Date(park.updatedAt), { addSuffix: true });
  } else if (park.createdAt) {
    lastUpdated = `Created ${formatDistanceToNow(new Date(park.createdAt), { addSuffix: true })}`;
  }

  return (
    <Card className="relative overflow-hidden border-xpenergy-primary/20 hover:border-xpenergy-primary/40 transition-all duration-300 shadow-sm hover:shadow-md">
      {/* Background Image with 35% opacity */}
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{
          backgroundImage: "url(https://ynslzmpfhmoghvcacwzd.supabase.co/storage/v1/object/public/images/XPcanvas.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: "0.35", // Increased to 35%
          mixBlendMode: "overlay"
        }}
      />
      
      <CardHeader className="pb-2 relative">
        <CardTitle className="text-lg font-semibold text-xpenergy-primary">
          {park.name}
        </CardTitle>
        <CardDescription>
          {park.description || 'No description'}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pb-4 relative">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <div className="flex items-center">
            <Database className="mr-1 h-4 w-4" />
            <span>
              {rowCount} {rowCount === 1 ? 'Row' : 'Rows'}, {barcodeCount} Barcodes
            </span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          <Calendar className="inline-block mr-1 h-3 w-3" />
          {lastUpdated}
        </div>
      </CardContent>
      
      <CardFooter className="pt-2 flex justify-between gap-2 relative">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="default" size="sm" className="flex-1 bg-xpenergy-primary hover:bg-xpenergy-primary/90">
                <Link to={`/park/${park.id}`}>
                  <FolderOpen className="mr-1 h-4 w-4" />
                  <span>Open</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>View park details and rows</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link to={`/scan/park/${park.id}`}>
                  <Scan className="mr-1 h-4 w-4" />
                  <span>Scan</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Scan barcodes in this park</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardFooter>
    </Card>
  );
};

export default ParkCard;
