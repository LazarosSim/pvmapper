
import React, { useEffect, useState } from 'react';
import { useDB } from '@/lib/db-provider';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabase } from '@/lib/supabase-provider';
import { Loader } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  requireManager?: boolean;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, requireManager = false }) => {
  const { currentUser, isDBLoading } = useDB();
  const { user, isInitialized } = useSupabase();
  const navigate = useNavigate();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [redirectPath, setRedirectPath] = useState('');

  // Store current route for navigation persistence (excluding login page)
  useEffect(() => {
    if (location.pathname !== '/login' && user) {
      localStorage.setItem('lastRoute', location.pathname);
    }
  }, [location.pathname, user]);

  useEffect(() => {
    // Only run the auth check if both supabase and DB providers are initialized
    if (isInitialized && !isDBLoading) {
      // If user is not logged in, redirect to login
      if (!user) {
        setShouldRedirect(true);
        setRedirectPath('/login');
        return;
      }

      // If manager role is required but user is not a manager, redirect to home
      if (requireManager && currentUser?.role !== 'manager') {
        setShouldRedirect(true);
        setRedirectPath('/');
        return;
      }

      // Auth check is complete
      setAuthChecked(true);
    }
  }, [user, currentUser, requireManager, isInitialized, isDBLoading]);
  
  // Handle redirect after all hooks are declared
  useEffect(() => {
    if (shouldRedirect && redirectPath) {
      navigate(redirectPath);
    }
  }, [shouldRedirect, redirectPath, navigate]);

  // Always render the same component structure
  if (!authChecked && !shouldRedirect) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center space-y-2">
          <Loader className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Return children only after auth is checked and requirements are met
  return <>{children}</>;
};

export default AuthGuard;
