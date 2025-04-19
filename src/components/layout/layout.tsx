
import React from 'react';
import Header from './header';
import BottomNav from './bottom-nav';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  showBack?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, title, showBack }) => {
  return (
    <div className="min-h-screen bg-inventory-background flex flex-col">
      <Header title={title} showBack={showBack} />
      <main className="flex-1 p-4 pb-20 overflow-y-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  );
};

export default Layout;
