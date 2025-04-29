
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  titleAction?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ title, showBack = false, titleAction }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const handleBackClick = () => {
    // Special handling for navigation between scan flows
    if (location.pathname.startsWith('/scan/park/')) {
      navigate('/scan');
      return;
    }
    
    if (location.pathname.startsWith('/scan/row/')) {
      // Extract parkId from localStorage
      const rememberedParkId = localStorage.getItem('selectedParkId');
      if (rememberedParkId) {
        navigate(`/scan/park/${rememberedParkId}`);
        return;
      }
    }
    
    // Special handling for navigation between main flows
    if (location.pathname.startsWith('/park/')) {
      navigate('/');
      return;
    }
    
    if (location.pathname.startsWith('/row/')) {
      // Extract parkId from localStorage
      const rememberedParkId = localStorage.getItem('selectedParkId');
      if (rememberedParkId) {
        navigate(`/park/${rememberedParkId}`);
        return;
      }
    }
    
    // Default behavior
    navigate(-1);
  };
  
  return (
    <header className="sticky top-0 w-full bg-gradient-to-r from-xpenergy-primary to-xpenergy-secondary text-white py-4 px-4 flex items-center z-10 shadow-md">
      <div className="flex-1 flex items-center">
        {showBack && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleBackClick}
            className="mr-2 text-white hover:bg-xpenergy-primary/20 hover:text-white/90"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
        )}
        <div className="flex items-center">
          <img 
            src="https://ynslzmpfhmoghvcacwzd.supabase.co/storage/v1/object/public/images/xplogo.png"
            alt="XP Energy Logo" 
            className="h-10 mr-3"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.src = '/placeholder.svg';
              console.error('Failed to load XP Energy logo');
            }}
          />
          {titleAction ? titleAction : <h1 className="text-xl font-semibold font-montserrat">{title}</h1>}
        </div>
      </div>
    </header>
  );
};

export default Header;
