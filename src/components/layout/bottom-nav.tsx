
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Database, Barcode, Search, Save } from 'lucide-react';

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 shadow-lg py-2 px-4 flex justify-around items-center z-10">
      <Button 
        variant="ghost" 
        size="sm" 
        className={`flex flex-col items-center gap-1 ${isActive('/') ? 'text-inventory-primary' : 'text-inventory-muted'}`}
        onClick={() => navigate('/')}
      >
        <Database className="h-5 w-5" />
        <span className="text-xs">Parks</span>
      </Button>
      
      <Button 
        variant="ghost" 
        size="sm" 
        className={`flex flex-col items-center gap-1 ${isActive('/scan') ? 'text-inventory-primary' : 'text-inventory-muted'}`}
        onClick={() => navigate('/scan')}
      >
        <Barcode className="h-5 w-5" />
        <span className="text-xs">Scan</span>
      </Button>
      
      <Button 
        variant="ghost" 
        size="sm" 
        className={`flex flex-col items-center gap-1 ${isActive('/search') ? 'text-inventory-primary' : 'text-inventory-muted'}`}
        onClick={() => navigate('/search')}
      >
        <Search className="h-5 w-5" />
        <span className="text-xs">Search</span>
      </Button>
      
      <Button 
        variant="ghost" 
        size="sm" 
        className={`flex flex-col items-center gap-1 ${isActive('/backup') ? 'text-inventory-primary' : 'text-inventory-muted'}`}
        onClick={() => navigate('/backup')}
      >
        <Save className="h-5 w-5" />
        <span className="text-xs">Backup</span>
      </Button>
    </nav>
  );
};

export default BottomNav;
