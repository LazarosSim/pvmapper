
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart2, Home, ScanBarcode, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDB } from '@/lib/db-provider';

const BottomNav = () => {
  const location = useLocation();
  const { currentUser } = useDB();
  
  if (!currentUser) return null;
  
  const isManager = currentUser?.role === 'manager';
  
  const links = [
    {
      href: '/',
      label: 'Home',
      icon: <Home className="h-5 w-5" />,
      active: location.pathname === '/'
    }, 
    {
      href: '/scan',
      label: 'Scan',
      icon: <ScanBarcode className="h-5 w-5" />,
      active: location.pathname.startsWith('/scan')
    }, 
    {
      href: '/profile',
      label: 'Profile',
      icon: <User className="h-5 w-5" />,
      active: location.pathname === '/profile'
    }
  ];

  // Add dashboard for managers
  if (isManager) {
    links.push({
      href: '/dashboard',
      label: 'Dashboard',
      icon: <BarChart2 className="h-5 w-5" />,
      active: location.pathname === '/dashboard'
    });
  }
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t shadow-lg py-2 px-4 z-10 bg-gradient-to-r from-[#F97316] to-[#FDBA74]">
      <div className="flex items-center justify-around">
        {links.map(link => (
          <Link 
            key={link.href} 
            to={link.href} 
            className={cn(
              "flex flex-col items-center px-2 py-1 rounded-md",
              link.active 
                ? "text-white font-medium" 
                : "text-white/80 hover:text-white transition"
            )}
          >
            {link.icon}
            <span className="mt-1 text-xs font-medium">{link.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
