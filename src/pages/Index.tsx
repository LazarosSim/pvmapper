import React, {useState} from 'react';
import Layout from '@/components/layout/layout';
import ParkCard from '@/components/parks/park-card';
import {Button} from '@/components/ui/button';
import {Archive, Plus} from 'lucide-react';
import CreateParkDialog from '@/components/dialog/create-park-dialog';
import {Input} from '@/components/ui/input';
import {useParkStats} from '@/hooks/use-park-queries';
import {useCurrentUser} from "@/hooks/use-user.tsx";
import {Badge} from '@/components/ui/badge';

const Index = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const {data: parks} = useParkStats(showArchived);

  const filteredParks = parks ? parks.filter(park =>
    park.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  // Separate active and archived parks for display
  const activeParks = filteredParks.filter(p => !p.archived);
  const archivedParks = filteredParks.filter(p => p.archived);

  const {data: currentUser} = useCurrentUser()
  const isUserManager = currentUser?.role === 'manager';


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
        <div className="flex items-center space-x-2 mb-4">
          <Input
            placeholder="Search parks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-white/90 backdrop-blur-sm border border-xpenergy-secondary/30 focus-visible:ring-xpenergy-primary shadow-sm"
          />
        </div>

        {/* Archive filter toggle - only show to managers */}
        {isUserManager && (
          <div className="flex items-center justify-end mb-4">
            <Button
              variant={showArchived ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2"
            >
              <Archive className="h-4 w-4" />
              {showArchived ? 'Hide Archived' : 'Show Archived'}
              {showArchived && archivedParks.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {archivedParks.length}
                </Badge>
              )}
            </Button>
          </div>
        )}

        {/* Active Parks */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {activeParks.length > 0 ? (
            activeParks.map(park => (
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

        {/* Archived Parks Section */}
        {showArchived && archivedParks.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-muted-foreground mb-4 flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Archived Parks
            </h2>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {archivedParks.map(park => (
                <div key={park.id} className="animate-fade-in opacity-75" style={{ animationDelay: '0.1s' }}>
                  <ParkCard park={park} />
                </div>
              ))}
            </div>
          </div>
        )}

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
