
import React from 'react';

const XPLogo: React.FC = () => {
  return (
    <div className="fixed bottom-16 left-4 z-20">
      <img 
        src="https://ynslzmpfhmoghvcacwzd.supabase.co/storage/v1/object/public/images/XP-Energy_Logo-White-Horizontal.svg" 
        alt="XP Energy Logo"
        className="h-8 opacity-80 hover:opacity-100 transition-opacity"
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          img.style.display = 'none';
          console.error('Failed to load XP Energy logo');
        }}
      />
    </div>
  );
};

export default XPLogo;
