
import React, { useEffect, useState } from 'react';
import { useDB } from '@/lib/db-provider';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '@/lib/supabase-provider';

interface AuthGuardProps {
  children: React.ReactNode;
  requireManager?: boolean;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, requireManager = false }) => {
  const { currentUser } = useDB();
  const { user } = useSupabase();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Only proceed with auth checking if we have both pieces of data
    if (user === null || currentUser !== undefined) {
      setIsChecking(false);
      
      if (!user) {
        navigate('/login');
        return;
      }

      if (requireManager && currentUser?.role !== 'manager') {
        navigate('/');
        return;
      }
    }
  }, [user, currentUser, requireManager, navigate]);

  // While checking auth status, show a minimal loading indicator
  if (isChecking) {
    return (
      <div className="flex items-center justify-center p-4">
        <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  // If not authenticated, render nothing - redirect will happen in effect
  if (!user) {
    return null;
  }

  // If manager is required but user is not a manager, render nothing - redirect will happen in effect
  if (requireManager && currentUser?.role !== 'manager') {
    return null;
  }

  return <>{children}</>;
};

export default AuthGuard;
