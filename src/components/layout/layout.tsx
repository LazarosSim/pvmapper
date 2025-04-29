
import React from 'react';
import Header from './header';
import BottomNav from './bottom-nav';
import XPLogo from './xp-logo';

interface LayoutProps {
  children: React.ReactNode;
  title: React.ReactNode | string; // Allow both ReactNode and string
  showBack?: boolean;
  titleAction?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children, title, showBack, titleAction }) => {
  // Convert non-string titles to string to ensure compatibility
  const titleString = typeof title === 'string' 
    ? title 
    : React.isValidElement(title) 
      ? '' // Or you could extract text content if needed
      : String(title);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-montserrat">
      <Header 
        title={titleString} 
        showBack={showBack} 
        titleAction={titleAction} 
      />
      <main 
        className="flex-1 p-4 pb-20 overflow-y-auto bg-gradient-to-b from-white to-gray-50 relative"
        style={{
          position: 'relative',
        }}
      >
        {/* Background canvas with 50% opacity */}
        <div 
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: 'url("https://ynslzmpfhmoghvcacwzd.supabase.co/storage/v1/object/public/images/XPcanvas.png")',
            backgroundSize: '500px',
            backgroundRepeat: 'repeat',
            opacity: 0.5,
          }}
        />
        
        {/* Content on top of background */}
        <div className="relative z-10">
          {children}
        </div>
      </main>
      <XPLogo />
      <BottomNav />
    </div>
  );
};

export default Layout;
