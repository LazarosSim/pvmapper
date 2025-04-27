
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '@/lib/supabase-provider';

interface AuthGuardProps {
  children: React.ReactNode;
  requireManager?: boolean;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, requireManager = false }) => {
  const { user } = useSupabase();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  return <>{children}</>;
};

export default AuthGuard;
