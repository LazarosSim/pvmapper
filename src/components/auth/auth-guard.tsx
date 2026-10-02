
import React, { useEffect, useState } from 'react';
import { useDB } from '@/lib/db-provider';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabase } from '@/lib/supabase-provider';
import { Clock, Loader, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuthGuardProps {
  children: React.ReactNode;
  requireManager?: boolean;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, requireManager = false }) => {
  const { currentUser, isDBLoading, logout } = useDB();
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

  // New accounts wait for a manager's approval before they can see or change any data
  if (authChecked && currentUser?.role === 'pending') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-sm text-center space-y-4">
          <Clock className="h-10 w-10 mx-auto text-primary" />
          <h1 className="text-xl font-semibold">Waiting for approval</h1>
          <p className="text-sm text-muted-foreground">
            Your account <strong>{currentUser.username}</strong> was created. A manager needs to
            approve it before you can start scanning.
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
      </div>
    );
  }

  // Return children only after auth is checked and requirements are met
  return <>{children}</>;
};

export default AuthGuard;
