
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
      <main className="flex-1 p-4 pb-20 overflow-y-auto bg-gradient-to-b from-[#E8F4FF] to-[#D3EAFF]">
        {children}
      </main>
      <XPLogo />
      <BottomNav />
    </div>
  );
};

export default Layout;
