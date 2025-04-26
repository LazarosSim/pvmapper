
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Database } from 'lucide-react';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  titleAction?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ title, showBack = false, titleAction }) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header className="sticky top-0 w-full bg-inventory-primary text-white py-4 px-4 flex items-center z-10 shadow-md">
      <div className="flex-1 flex items-center">
        {showBack && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)}
            className="mr-2 text-white hover:bg-inventory-primary hover:text-white/80"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
        )}
        <div className="flex items-center">
          <Database className="h-6 w-6 mr-2" />
          {titleAction ? titleAction : <h1 className="text-xl font-semibold">{title}</h1>}
        </div>
      </div>
    </header>
  );
};

export default Header;
