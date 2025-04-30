
import React, { useState } from 'react';
import { useDB } from '@/lib/db-provider';
import Layout from '@/components/layout/layout';
import ParkCard from '@/components/parks/park-card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import CreateParkDialog from '@/components/dialog/create-park-dialog';
import { Input } from '@/components/ui/input';

const Index = () => {
  const { parks, currentUser, isManager } = useDB();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredParks = parks ? parks.filter(park => 
    park.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  // Check if the user is a manager
  const isUserManager = isManager();

  return (
    <Layout title={
      <div className="flex items-center space-x-2">
        <span className="font-montserrat text-xl font-semibold bg-gradient-to-r from-white to-white/80 bg-clip-text">
          XP Energy
        </span>
        <span className="font-montserrat text-xl font-semibold bg-gradient-to-r from-white/90 to-white/70 bg-clip-text">
          PV MAPPER
        </span>
      </div>
    }>
      <div className="flex flex-col">
        <div className="flex items-center space-x-2 mb-6">
          <Input
            placeholder="Search parks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-white/90 backdrop-blur-sm border border-xpenergy-secondary/30 focus-visible:ring-xpenergy-primary shadow-sm"
          />
        </div>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {filteredParks.length > 0 ? (
            filteredParks.map(park => (
              <div key={park.id} className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <ParkCard park={park} />
              </div>
            ))
          ) : (
            <div className="text-center py-8 col-span-full glass-card rounded-lg p-8 animate-fade-in">
              <p className="text-muted-foreground mb-4">
                {searchQuery ? "No parks found matching your search" : "No parks found. Create your first park to get started."}
              </p>
            </div>
          )}
        </div>
        
        {/* Only show the add park button to managers */}
        {isUserManager && (
          <Button 
            onClick={() => setIsDialogOpen(true)}
            className="fixed bottom-20 right-4 rounded-full w-14 h-14 shadow-lg bg-gradient-to-r from-xpenergy-primary to-xpenergy-secondary hover:from-xpenergy-primary/90 hover:to-xpenergy-secondary/90 transition-all duration-300"
          >
            <Plus className="h-6 w-6" />
          </Button>
        )}
        
        <CreateParkDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
      </div>
    </Layout>
  );
};

export default Index;
