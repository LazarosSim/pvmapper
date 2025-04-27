
import React, { useState } from 'react';
import { useDB } from '@/lib/db-provider';
import Layout from '@/components/layout/layout';
import ParkCard from '@/components/parks/park-card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import CreateParkDialog from '@/components/dialog/create-park-dialog';
import { Input } from '@/components/ui/input';

const Index = () => {
  const { parks } = useDB();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Make sure parks is defined before filtering
  const filteredParks = parks ? parks.filter(park => 
    park.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  return (
    <Layout title={
      <span className="font-montserrat text-xl bg-gradient-to-r from-white to-white/80 bg-clip-text">
        XP Energy PV Mapper
      </span>
    }>
      <div className="flex flex-col">
        <div className="flex items-center space-x-2 mb-6">
          <Input
            placeholder="Search parks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-white/80 backdrop-blur-sm border border-inventory-secondary/30 focus-visible:ring-inventory-primary"
          />
        </div>

        {filteredParks.length > 0 ? (
          filteredParks.map(park => (
            <ParkCard key={park.id} park={park} />
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "No parks found matching your search" : "No parks found. Create your first park to get started."}
            </p>
          </div>
        )}
        
        <Button 
          onClick={() => setIsDialogOpen(true)}
          className="fixed bottom-20 right-4 rounded-full w-14 h-14 shadow-lg bg-inventory-primary hover:bg-inventory-primary/90"
        >
          <Plus className="h-6 w-6" />
        </Button>
        
        <CreateParkDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
      </div>
    </Layout>
  );
};

export default Index;
