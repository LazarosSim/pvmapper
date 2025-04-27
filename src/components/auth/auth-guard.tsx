
import React, { useEffect, useState } from 'react';
import { useDB } from '@/lib/db-provider';
import { useNavigate } from 'react-router-dom';
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
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Only run the auth check if both supabase and DB providers are initialized
    if (isInitialized && !isDBLoading) {
      // If user is not logged in, redirect to login
      if (!user) {
        navigate('/login');
        return;
      }

      // If manager role is required but user is not a manager, redirect to home
      if (requireManager && currentUser?.role !== 'manager') {
        navigate('/');
        return;
      }

      // Auth check is complete
      setAuthChecked(true);
    }
  }, [user, currentUser, requireManager, navigate, isInitialized, isDBLoading]);

  // Show loading indicator while checking auth status
  if (!authChecked) {
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
