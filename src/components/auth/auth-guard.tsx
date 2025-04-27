
import React, { useEffect } from 'react';
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

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (requireManager && currentUser?.role !== 'manager') {
      navigate('/');
      return;
    }
  }, [user, currentUser, requireManager, navigate]);

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
